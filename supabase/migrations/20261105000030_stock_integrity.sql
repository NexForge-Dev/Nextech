-- 0030 stock integrity (QA 2026-11-05). Same signatures as before: safe to run twice and with the
-- previous code still running (which sends neither of the new fields and never relied on the old holes).
--  1. a hold on stock lasts 30 minutes for card and 70 for Pix (its QR code lives 60), and one account
--     can hold at most 10 units of a product (NXT-005);
--  2. stock goes back only while the goods are still here: full refund before shipping yes, cancelling
--     after shipping no (NXT-021);
--  3. create_order_from_cart locks products in a fixed order (NXT-011) and enforces, on its own, the
--     address and seller rules that only the server action checked (NXT-013);
--  4. a new wrapper saves a product without overwriting stock sold while the form was open (NXT-006).

-- 1. expiry (same signature as 0024) -------------------------------------------------------------
create or replace function public.stale_unpaid_orders()
returns table (order_id uuid, payment_intent text, payment_method text)
language sql stable security definer set search_path = public as $$
  select o.id, o.stripe_payment_intent_id, o.payment_method from orders o
  where o.status = 'awaiting_payment'
    and o.created_at < now() - case
      when o.payment_method = 'boleto' then interval '7 days'
      when exists (select 1 from order_items i where i.order_id = o.id and i.stock_taken > 0) then
        case when o.payment_method = 'pix' then interval '70 minutes' else interval '30 minutes' end
      else interval '1 day'
    end
  order by o.created_at
  limit 200;
$$;

-- 2. stock return (same trigger as 0026) ---------------------------------------------------------
create or replace function public.order_release_stock() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('cancelled', 'refunded') and old.status <> new.status
     and old.status not in ('shipped', 'in_transit', 'delivered') then
    update product_sale s set stock_quantity = coalesce(s.stock_quantity, 0) + i.stock_taken
    from order_items i where i.order_id = new.id and i.product_id = s.product_id and i.stock_taken > 0;
    update order_items set stock_taken = 0 where order_id = new.id and stock_taken > 0;
  end if;
  return new;
end $$;
revoke all on function public.order_release_stock() from public, anon, authenticated;

-- 3. order creation (same signature as 0026) -----------------------------------------------------
-- Mirrors addressSchema in src/lib/orders/checkout.ts; CPF digits are verified there.
create or replace function public.checkout_address_valid(a jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(a) = 'object'
    and char_length(btrim(coalesce(a ->> 'recipientName', ''))) between 3 and 120
    and btrim(a ->> 'recipientName') like '% %'
    and coalesce(a ->> 'cpf', '') ~ '^[0-9]{11}$'
    and coalesce(a ->> 'phone', '') ~ '^[0-9]{10,11}$'
    and coalesce(a ->> 'cep', '') ~ '^[0-9]{8}$'
    and char_length(btrim(coalesce(a ->> 'street', ''))) between 2 and 160
    and char_length(btrim(coalesce(a ->> 'number', ''))) between 1 and 20
    and char_length(coalesce(a ->> 'complement', '')) <= 80
    and char_length(btrim(coalesce(a ->> 'district', ''))) between 2 and 80
    and char_length(btrim(coalesce(a ->> 'city', ''))) between 2 and 80
    and coalesce(a ->> 'state', '') in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO');
$$;
revoke all on function public.checkout_address_valid(jsonb) from public, anon, authenticated;

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
    select p.id, p.slug, s.price_minor, s.pix_discount_pct, s.available, s.fulfillment,
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

-- 4. product save: a wrapper, so it never replaces admin_save_product_full, whichever version is live ---
-- Sent the stock the form read, it keeps orders placed meanwhile. Checkout locks product_sale and then
-- touches products; the same order here, or the two deadlock. Holding this lock also means a checkout
-- either finished before this read or waits for this save.
create or replace function public.admin_save_product_stock_safe(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_sale jsonb := p -> 'sale';
  v_stock int := nullif(v_sale ->> 'stockQuantity', '')::int;
  v_read int := nullif(v_sale ->> 'stockRead', '')::int;
  v_current int;
  v_exists boolean := false;
begin
  select stock_quantity, true into v_current, v_exists from product_sale where product_id = nullif(p ->> 'id', '')::uuid for update;
  if v_sale ? 'stockRead' and v_stock is not null and v_exists then
    if v_stock is not distinct from v_read then
      p := jsonb_set(p, '{sale,stockQuantity}', to_jsonb(coalesce(v_current, v_stock)));
    elsif v_current is distinct from v_read and v_current is distinct from v_stock then
      raise exception 'stock_changed' using errcode = 'P0001';
    end if;
  end if;
  return public.admin_save_product_full(p);
end $$;
revoke all on function public.admin_save_product_stock_safe(jsonb) from public, anon;
grant execute on function public.admin_save_product_stock_safe(jsonb) to authenticated;
