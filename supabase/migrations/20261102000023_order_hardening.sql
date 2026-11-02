-- 0023 order hardening (final review):
--  * customer views are read-only (Supabase default privileges had granted writes on them)
--  * admin item/status changes are locked SQL transitions that refuse closed orders and stale reads
--  * checkout refuses a total that changed since the customer saw it
--  * payments that succeed on a cancelled order are reported; stuck webhook claims can be retried
--  * abandoned unpaid orders are cancelled

-- 1. read-only customer views ---------------------------------------------------------------
revoke all on public.my_orders, public.my_order_items from public, anon, authenticated;
grant select on public.my_orders, public.my_order_items to authenticated;

-- 2. checkout price guard ---------------------------------------------------------------------
-- New optional p_expected_total: when given and different from the computed total → price_changed.
drop function if exists public.create_order_from_cart(jsonb, jsonb, text, boolean);
create or replace function public.create_order_from_cart(p_items jsonb, p_address jsonb, p_method text, p_save_address boolean default false, p_expected_total bigint default null)
returns table (order_id uuid, order_number bigint, total_minor bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_models jsonb;
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
  select email into v_email from auth.users where id = v_user;
  select value into v_models from site_settings where key = 'public.business_models';
  if not coalesce((v_models ->> 'own_store')::boolean, true) then raise exception 'store_closed' using errcode = 'P0001'; end if;
  if p_method not in ('card', 'boleto', 'pix') or not coalesce((v_models -> 'payments' ->> p_method)::boolean, p_method <> 'pix') then
    raise exception 'method_disabled' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'cart_empty' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'cart_too_large' using errcode = 'P0001'; end if;

  create temp table _lines (product_id uuid, name text, slug text, image_path text, price bigint, pct numeric, qty int) on commit drop;
  for v_item in select * from jsonb_array_elements(p_items) loop
    select p.id, p.slug, s.price_minor, s.pix_discount_pct, s.available,
      coalesce((select t.name from product_translations t where t.product_id = p.id and t.locale = 'pt-BR'),
               (select t.name from product_translations t where t.product_id = p.id limit 1), p.slug) as pname,
      (select i.path from product_images i where i.product_id = p.id order by i.is_main desc, i.sort_order limit 1) as img
    into v_row
    from products p join product_sale s on s.product_id = p.id
    where p.id = (v_item ->> 'productId')::uuid and p.status = 'published' and p.sale_mode = 'own';
    if not found then raise exception 'item_unavailable:%', coalesce(v_item ->> 'productId', '?') using errcode = 'P0001'; end if;
    if not v_row.available then raise exception 'item_unavailable:%', v_row.slug using errcode = 'P0001'; end if;
    if coalesce((v_item ->> 'quantity')::int, 0) not between 1 and 10 then raise exception 'invalid_quantity' using errcode = 'P0001'; end if;
    if exists (select 1 from _lines where product_id = v_row.id) then raise exception 'duplicate_item' using errcode = 'P0001'; end if;
    insert into _lines values (v_row.id, v_row.pname, v_row.slug, v_row.img, v_row.price_minor, v_row.pix_discount_pct, (v_item ->> 'quantity')::int);
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

  insert into order_items (order_id, product_id, name, slug, image_path, unit_price_minor, pix_discount_pct, quantity, line_total_minor)
  select v_order, l.product_id, l.name, l.slug, l.image_path, l.price, l.pct, l.qty, l.price * l.qty from _lines l;

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

-- 3. locked admin transitions (service role only) ---------------------------------------------
-- Item purchase/tracking. p_patch: {supplierId, supplierCostMinor, supplierOrderRef, supplierUrl,
-- trackingCarrier, trackingCode, trackingUrl, purchased}. Returns the order status after the change.
create or replace function public.admin_update_order_item(p_item uuid, p_patch jsonb, p_actor uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_item order_items%rowtype;
  v_order orders%rowtype;
  v_purchased boolean := coalesce((p_patch ->> 'purchased')::boolean, false);
  v_status text;
begin
  select * into v_item from order_items where id = p_item;
  if not found then raise exception 'item_not_found' using errcode = 'P0002'; end if;
  -- lock the order first: serialises with customer_cancel_order and other admin writes
  select * into v_order from orders where id = v_item.order_id for update;
  select * into v_item from order_items where id = p_item for update;
  if v_order.status in ('cancelled', 'refunded') then raise exception 'order_closed' using errcode = 'P0001'; end if;
  if not v_purchased and v_item.supplier_purchased_at is not null and v_order.status in ('shipped', 'in_transit', 'delivered') then
    raise exception 'already_shipped' using errcode = 'P0001';
  end if;
  update order_items set
    supplier_id = nullif(p_patch ->> 'supplierId', '')::uuid,
    supplier_cost_minor = nullif(p_patch ->> 'supplierCostMinor', '')::bigint,
    supplier_order_ref = nullif(p_patch ->> 'supplierOrderRef', ''),
    supplier_url = nullif(p_patch ->> 'supplierUrl', ''),
    supplier_purchased_at = case when v_purchased then coalesce(supplier_purchased_at, now()) else null end,
    tracking_carrier = nullif(p_patch ->> 'trackingCarrier', ''),
    tracking_code = nullif(p_patch ->> 'trackingCode', ''),
    tracking_url = nullif(p_patch ->> 'trackingUrl', '')
  where id = p_item;
  v_status := v_order.status;
  if v_purchased and v_item.supplier_purchased_at is null then
    insert into order_events (order_id, actor, actor_id, kind, data)
    values (v_order.id, 'admin', p_actor, 'supplier_purchase', jsonb_build_object('item', p_item, 'cost', p_patch -> 'supplierCostMinor', 'ref', p_patch -> 'supplierOrderRef'));
    if v_order.status in ('paid', 'awaiting_supplier') then
      update orders set status = 'supplier_purchased' where id = v_order.id;
      insert into order_events (order_id, actor, actor_id, kind, data) values (v_order.id, 'admin', p_actor, 'status_changed', jsonb_build_object('from', v_order.status, 'to', 'supplier_purchased'));
      v_status := 'supplier_purchased';
    end if;
  else
    insert into order_events (order_id, actor, actor_id, kind, data) values (v_order.id, 'admin', p_actor, 'item_updated', jsonb_build_object('item', p_item, 'tracking', p_patch -> 'trackingCode'));
  end if;
  return v_status;
end $$;

-- Status change guarded by the status the admin saw (p_expected). Closed orders cannot be reopened.
create or replace function public.admin_set_order_status(p_order uuid, p_expected text, p_to text, p_actor uuid, p_data jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_kind text;
begin
  select * into v_order from orders where id = p_order for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if v_order.status in ('cancelled', 'refunded') then raise exception 'order_closed' using errcode = 'P0001'; end if;
  if v_order.status <> p_expected then raise exception 'status_changed' using errcode = 'P0001'; end if;
  if p_to in ('awaiting_payment', 'paid') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  if p_to in ('shipped', 'in_transit', 'delivered') and exists (select 1 from order_items where order_id = p_order and coalesce(btrim(tracking_code), '') = '') then
    raise exception 'missing_tracking' using errcode = 'P0001';
  end if;
  update orders set status = p_to, cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end where id = p_order;
  v_kind := case when p_to in ('shipped', 'in_transit') then 'shipped' when p_to = 'delivered' then 'delivered' when p_to = 'cancelled' then 'cancelled' else 'status_changed' end;
  insert into order_events (order_id, actor, actor_id, kind, data)
  values (p_order, 'admin', p_actor, v_kind, jsonb_build_object('from', v_order.status, 'to', p_to) || coalesce(p_data, '{}'::jsonb));
end $$;

-- 4. paid-after-cancel is reported -------------------------------------------------------------
drop function if exists public.order_mark_paid(text, uuid, bigint, text);
create or replace function public.order_mark_paid(p_pi text, p_order uuid, p_fee bigint, p_summary text)
returns table (order_id uuid, transitioned boolean, was_cancelled boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where id = p_order and (stripe_payment_intent_id = p_pi or stripe_payment_intent_id is null) for update;
  if not found then return; end if;
  if v_order.status <> 'awaiting_payment' then
    update orders set stripe_fee_minor = coalesce(stripe_fee_minor, p_fee), payment_summary = coalesce(payment_summary, p_summary),
      paid_at = case when v_order.status = 'cancelled' then coalesce(paid_at, now()) else paid_at end
    where id = v_order.id;
    if v_order.status = 'cancelled' and v_order.paid_at is null then
      insert into order_events (order_id, actor, kind, data) values (v_order.id, 'stripe', 'paid_after_cancel', jsonb_build_object('fee', p_fee));
    end if;
    return query select v_order.id, false, (v_order.status = 'cancelled' and v_order.paid_at is null);
    return;
  end if;
  update orders set status = 'awaiting_supplier', paid_at = now(), stripe_payment_intent_id = p_pi, stripe_fee_minor = p_fee, payment_summary = p_summary
  where id = v_order.id;
  insert into order_events (order_id, actor, kind, data) values (v_order.id, 'stripe', 'paid', jsonb_build_object('fee', p_fee, 'summary', p_summary));
  return query select v_order.id, true, false;
end $$;

-- 5. webhook claims: duplicates are skipped only once processed; a claim stuck for 2 minutes is retried
create or replace function public.claim_stripe_event(p_id text, p_type text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_rows int;
begin
  insert into stripe_events (id, type) values (p_id, p_type) on conflict (id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 1 then return true; end if;
  update stripe_events set received_at = now() where id = p_id and processed_at is null and received_at < now() - interval '2 minutes';
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

-- 6. abandoned unpaid orders: boleto after its 3-day expiry + 1 day, card/Pix after 1 day ---------
create or replace function public.cancel_stale_orders()
returns table (order_id uuid, payment_intent text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with stale as (
    select o.id, o.stripe_payment_intent_id from orders o
    where o.status = 'awaiting_payment'
      and o.created_at < now() - case when o.payment_method = 'boleto' then interval '4 days' else interval '1 day' end
    for update skip locked
  ), upd as (
    update orders o set status = 'cancelled', cancelled_at = now() from stale where o.id = stale.id returning o.id, stale.stripe_payment_intent_id
  ), ev as (
    insert into order_events (order_id, actor, kind, data) select upd.id, 'system', 'cancelled', jsonb_build_object('reason', 'payment_expired') from upd
  )
  select upd.id, upd.stripe_payment_intent_id from upd;
end $$;

revoke all on function public.admin_update_order_item(uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.admin_set_order_status(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.order_mark_paid(text, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.claim_stripe_event(text, text) from public, anon, authenticated;
revoke all on function public.cancel_stale_orders() from public, anon, authenticated;
grant execute on function public.admin_update_order_item(uuid, jsonb, uuid) to service_role;
grant execute on function public.admin_set_order_status(uuid, text, text, uuid, jsonb) to service_role;
grant execute on function public.order_mark_paid(text, uuid, bigint, text) to service_role;
grant execute on function public.claim_stripe_event(text, text) to service_role;
grant execute on function public.cancel_stale_orders() to service_role;
