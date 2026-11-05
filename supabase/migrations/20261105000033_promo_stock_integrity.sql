-- 0033 joins the timed promotion (0030) with the stock integrity work (0032). Both migrations
-- replaced the same functions, so whichever ran last won; this one makes the two features coexist.
-- Safe to run twice and with the previous code still running.

-- 1. product save: the promo wrapper now goes through the stock-safe save ------------------------
-- 0030 calls admin_save_product_full directly, which would overwrite stock sold while the form was
-- open. Calling the 0032 wrapper keeps the stock check and then applies the promo in the same
-- transaction.
create or replace function public.admin_save_product_promo(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := public.admin_save_product_stock_safe(p);
  v_sale jsonb := p -> 'sale';
begin
  if p ->> 'saleMode' = 'own' then
    update product_sale set
      promo_price_minor = nullif(v_sale ->> 'promoPriceMinor', '')::bigint,
      promo_starts_at = nullif(v_sale ->> 'promoStartsAt', '')::timestamptz,
      promo_ends_at = nullif(v_sale ->> 'promoEndsAt', '')::timestamptz
    where product_id = v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.admin_save_product_promo(jsonb) from public, anon;
grant execute on function public.admin_save_product_promo(jsonb) to authenticated;

-- 2. order creation: 0032's stock/address rules plus 0030's promo price ---------------------------
-- Same signature as 0026. The promo price is charged while it runs, and the fixed product order,
-- hold limits and address/legal checks from 0032 are kept.
create or replace function public.create_order_from_cart(p_items jsonb, p_address jsonb, p_method text, p_save_address boolean default false, p_expected_total bigint default null)
returns table (order_id uuid, order_number bigint, total_minor bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_models jsonb;
  v_legal jsonb;
  v_item jsonb;
  v_row record;
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_order uuid;
  v_number bigint;
  v_count int := 0;
  v_name text;
begin
  if v_user is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  -- at most 10 unpaid orders per hour per customer, serialised per user so a burst cannot slip through
  perform pg_advisory_xact_lock(hashtext('create_order:' || v_user::text));
  if (select count(*) from orders o where o.user_id = v_user and o.status = 'awaiting_payment' and o.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too_many_orders' using errcode = 'P0001';
  end if;
  select email into v_email from auth.users where id = v_user;
  select value into v_models from site_settings where key = 'public.business_models';
  if not coalesce((v_models ->> 'own_store')::boolean, true) then raise exception 'store_closed' using errcode = 'P0001'; end if;
  -- same rule as isSellerIdentified: no sale until the seller is identified, however the call arrives
  select value into v_legal from site_settings where key = 'public.legal';
  if coalesce(btrim(v_legal ->> 'company_name'), '') = '' or coalesce(btrim(v_legal ->> 'tax_id'), '') = '' or coalesce(btrim(v_legal ->> 'address'), '') = '' then
    raise exception 'store_closed' using errcode = 'P0001';
  end if;
  if not public.checkout_address_valid(p_address) then raise exception 'invalid_address' using errcode = 'P0001'; end if;
  if p_method not in ('card', 'boleto', 'pix') or not coalesce((v_models -> 'payments' ->> p_method)::boolean, p_method <> 'pix') then
    raise exception 'method_disabled' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'cart_empty' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'cart_too_large' using errcode = 'P0001'; end if;

  create temp table _lines (product_id uuid, name text, slug text, image_path text, price bigint, pct numeric, qty int, taken int) on commit drop;
  -- a fixed order: two carts with the same products in opposite order would deadlock on product_sale
  for v_item in select value from jsonb_array_elements(p_items) order by value ->> 'productId' loop
    -- mirrors ownSaleNow() in src/lib/domain/own-pricing.ts; a promo above the price never applies
    select p.id, p.slug,
      case when public.promo_running(s.price_minor, s.promo_price_minor, s.promo_starts_at, s.promo_ends_at) then s.promo_price_minor else s.price_minor end as price_minor,
      s.pix_discount_pct, s.available, s.fulfillment,
      coalesce((select t.name from product_translations t where t.product_id = p.id and t.locale = 'pt-BR'),
               (select t.name from product_translations t where t.product_id = p.id limit 1), p.slug) as pname,
      (select i.path from product_images i where i.product_id = p.id order by i.is_main desc, i.sort_order limit 1) as img
    into v_row
    from products p join product_sale s on s.product_id = p.id
    where p.id = (v_item ->> 'productId')::uuid and p.status = 'published' and p.sale_mode = 'own';
    if not found then raise exception 'item_unavailable:%', coalesce(v_item ->> 'productId', '?') using errcode = 'P0001'; end if;
    if not v_row.available or not public.product_mode_enabled(v_row.id) then raise exception 'item_unavailable:%', v_row.slug using errcode = 'P0001'; end if;
    if coalesce((v_item ->> 'quantity')::int, 0) not between 1 and 10 then raise exception 'invalid_quantity' using errcode = 'P0001'; end if;
    if exists (select 1 from _lines where product_id = v_row.id) then raise exception 'duplicate_item' using errcode = 'P0001'; end if;
    -- own stock is reserved here, atomically: two buyers can't take the last unit
    if v_row.fulfillment = 'stock' then
      -- one account can't sit on a product's stock through unpaid orders
      if (select coalesce(sum(i.stock_taken), 0) from order_items i join orders o on o.id = i.order_id
          where o.user_id = v_user and o.status = 'awaiting_payment' and i.product_id = v_row.id) + (v_item ->> 'quantity')::int > 10 then
        raise exception 'too_many_orders' using errcode = 'P0001';
      end if;
      update product_sale set stock_quantity = stock_quantity - (v_item ->> 'quantity')::int
      where product_id = v_row.id and stock_quantity >= (v_item ->> 'quantity')::int;
      if not found then raise exception 'item_unavailable:%', v_row.slug using errcode = 'P0001'; end if;
    end if;
    insert into _lines values (v_row.id, v_row.pname, v_row.slug, v_row.img, v_row.price_minor, v_row.pix_discount_pct, (v_item ->> 'quantity')::int,
      case when v_row.fulfillment = 'stock' then (v_item ->> 'quantity')::int else 0 end);
    v_subtotal := v_subtotal + v_row.price_minor * (v_item ->> 'quantity')::int;
    if p_method = 'pix' then
      v_discount := v_discount + (v_row.price_minor - pix_price_minor(v_row.price_minor, v_row.pix_discount_pct)) * (v_item ->> 'quantity')::int;
    end if;
    v_count := v_count + 1;
  end loop;

  if p_expected_total is not null and p_expected_total <> v_subtotal - v_discount then raise exception 'price_changed' using errcode = 'P0001'; end if;
  if p_method = 'boleto' and (v_subtotal - v_discount < 500 or v_subtotal - v_discount > 4999999) then raise exception 'amount_out_of_range' using errcode = 'P0001'; end if;
  if p_method = 'pix' and v_subtotal - v_discount < 50 then raise exception 'amount_out_of_range' using errcode = 'P0001'; end if;

  v_name := btrim(p_address ->> 'recipientName');
  insert into orders (user_id, payment_method, subtotal_minor, discount_minor, total_minor, shipping, customer)
  values (
    v_user, p_method, v_subtotal, v_discount, v_subtotal - v_discount,
    jsonb_build_object(
      'recipientName', v_name, 'cep', p_address ->> 'cep', 'street', p_address ->> 'street', 'number', p_address ->> 'number',
      'complement', nullif(p_address ->> 'complement', ''), 'district', p_address ->> 'district', 'city', p_address ->> 'city', 'state', p_address ->> 'state'),
    jsonb_build_object('name', v_name, 'email', v_email, 'cpf', p_address ->> 'cpf', 'phone', p_address ->> 'phone')
  )
  returning id, number into v_order, v_number;

  insert into order_items (order_id, product_id, name, slug, image_path, unit_price_minor, pix_discount_pct, quantity, line_total_minor, stock_taken)
  select v_order, l.product_id, l.name, l.slug, l.image_path, l.price, l.pct, l.qty, l.price * l.qty, l.taken from _lines l;

  insert into order_events (order_id, actor, actor_id, kind, data)
  values (v_order, 'customer', v_user, 'created', jsonb_build_object('method', p_method, 'items', v_count, 'total', v_subtotal - v_discount));

  if p_save_address then
    insert into customer_addresses (user_id, recipient_name, cpf, phone, cep, street, number, complement, district, city, state, is_default)
    values (v_user, v_name, p_address ->> 'cpf', p_address ->> 'phone', p_address ->> 'cep', p_address ->> 'street', p_address ->> 'number',
            nullif(p_address ->> 'complement', ''), p_address ->> 'district', p_address ->> 'city', p_address ->> 'state',
            not exists (select 1 from customer_addresses where user_id = v_user));
  end if;

  return query select v_order, v_number, v_subtotal - v_discount;
end $$;
revoke all on function public.create_order_from_cart(jsonb, jsonb, text, boolean, bigint) from public, anon;
grant execute on function public.create_order_from_cart(jsonb, jsonb, text, boolean, bigint) to authenticated;
