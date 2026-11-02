-- 0020 own-store orders. Customers read their own orders; every write goes through security-definer
-- RPCs (customers) or the service role (Stripe webhook) — never direct table writes from the browser.

create sequence public.order_number_seq start 1001;

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipient_name text not null check (char_length(recipient_name) between 3 and 120),
  cpf text not null check (cpf ~ '^\d{11}$'),
  phone text not null check (phone ~ '^\d{10,11}$'),
  cep text not null check (cep ~ '^\d{8}$'),
  street text not null check (char_length(street) between 2 and 160),
  number text not null check (char_length(number) between 1 and 20),
  complement text check (char_length(complement) <= 80),
  district text not null check (char_length(district) between 2 and 80),
  city text not null check (char_length(city) between 2 and 80),
  state char(2) not null check (state ~ '^[A-Z]{2}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_addresses_user on public.customer_addresses (user_id);
create trigger customer_addresses_updated before update on public.customer_addresses for each row execute function public.set_updated_at();

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.order_number_seq'),
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'awaiting_payment' check (status in (
    'awaiting_payment', 'paid', 'awaiting_supplier', 'supplier_purchased', 'shipped', 'in_transit', 'delivered', 'cancelled', 'refunded')),
  payment_method text not null check (payment_method in ('card', 'boleto', 'pix')),
  currency text not null default 'BRL' check (currency = 'BRL'),
  subtotal_minor bigint not null check (subtotal_minor > 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  total_minor bigint not null check (total_minor > 0),
  stripe_payment_intent_id text unique,
  stripe_fee_minor bigint,
  payment_summary text,
  paid_at timestamptz,
  cancelled_at timestamptz,
  refunded_minor bigint not null default 0 check (refunded_minor >= 0),
  shipping jsonb not null,
  customer jsonb not null,
  boleto jsonb,
  invoice_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_minor = subtotal_minor - discount_minor),
  check (refunded_minor <= total_minor)
);
create index orders_user on public.orders (user_id, created_at desc);
create index orders_status on public.orders (status, created_at desc);
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,
  slug text,
  image_path text,
  unit_price_minor bigint not null check (unit_price_minor > 0),
  pix_discount_pct numeric(5, 2) not null default 0,
  quantity int not null check (quantity between 1 and 10),
  line_total_minor bigint not null check (line_total_minor > 0),
  supplier_id uuid references public.suppliers (id),
  supplier_cost_minor bigint check (supplier_cost_minor is null or supplier_cost_minor >= 0),
  supplier_order_ref text check (char_length(supplier_order_ref) <= 120),
  supplier_url text check (supplier_url is null or supplier_url ~ '^https://'),
  supplier_purchased_at timestamptz,
  tracking_carrier text check (char_length(tracking_carrier) <= 60),
  tracking_code text check (char_length(tracking_code) <= 60),
  tracking_url text check (tracking_url is null or tracking_url ~ '^https://'),
  created_at timestamptz not null default now()
);
create index order_items_order on public.order_items (order_id);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null check (actor in ('system', 'admin', 'customer', 'stripe')),
  actor_id uuid,
  kind text not null check (char_length(kind) between 1 and 60),
  data jsonb not null default '{}'::jsonb
);
create index order_events_order on public.order_events (order_id, at);

create table public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  method text not null check (method in ('stripe', 'manual')),
  stripe_refund_id text unique,
  status text not null default 'succeeded' check (status in ('pending', 'succeeded', 'failed', 'canceled')),
  note text check (char_length(note) <= 500),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index order_refunds_order on public.order_refunds (order_id);

create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.customer_addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.order_refunds enable row level security;
alter table public.stripe_events enable row level security;

create policy customer_addresses_own on public.customer_addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- orders, order_items, order_events, order_refunds, stripe_events: no policies → no direct access for
-- anon/authenticated. Customers read through the my_* views below (customer-safe columns only);
-- the admin panel reads with the service role after checking orders.read (pageGuard/adminAction).

create view public.my_orders with (security_barrier = true) as
  select o.id, o.number, o.status, o.payment_method, o.currency, o.subtotal_minor, o.discount_minor, o.total_minor,
         o.payment_summary, o.paid_at, o.cancelled_at, o.refunded_minor, o.shipping, o.boleto,
         (o.invoice_path is not null) as has_invoice, o.created_at,
         exists (select 1 from public.order_items i where i.order_id = o.id and i.supplier_purchased_at is not null) as any_purchased
  from public.orders o
  where o.user_id = auth.uid();

create view public.my_order_items with (security_barrier = true) as
  select i.id, i.order_id, i.product_id, i.name, i.slug, i.image_path, i.unit_price_minor, i.quantity, i.line_total_minor,
         i.tracking_carrier, i.tracking_code, i.tracking_url
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where o.user_id = auth.uid();

revoke all on public.my_orders, public.my_order_items from anon;
grant select on public.my_orders, public.my_order_items to authenticated;

-- Pix price, mirrors src/lib/domain/own-pricing.ts pixPriceMinor (round half up to the centavo).
create or replace function public.pix_price_minor(p_price bigint, p_pct numeric) returns bigint
language sql immutable as $$
  select case when round(coalesce(p_pct, 0) * 100) <= 0 then p_price
    else floor((p_price * (10000 - round(p_pct * 100)) + 5000) / 10000)::bigint end;
$$;

-- Create an order from the browser cart. Prices come from product_sale, never from the client.
-- p_items: [{productId, quantity}], p_address: {recipientName, cpf, phone, cep, street, number, complement, district, city, state}
create or replace function public.create_order_from_cart(p_items jsonb, p_address jsonb, p_method text, p_save_address boolean default false)
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

revoke all on function public.create_order_from_cart(jsonb, jsonb, text, boolean) from public, anon;
grant execute on function public.create_order_from_cart(jsonb, jsonb, text, boolean) to authenticated;

-- Customer timeline: only customer-safe events, no admin notes or supplier data.
create or replace function public.my_order_timeline(p_number bigint)
returns table (at timestamptz, kind text, data jsonb)
language sql stable security definer set search_path = public as $$
  select e.at, e.kind,
    case when e.kind = 'shipped' then jsonb_build_object('trackings', e.data -> 'trackings') else '{}'::jsonb end
  from order_events e join orders o on o.id = e.order_id
  where o.number = p_number and o.user_id = auth.uid()
    and e.kind in ('created', 'paid', 'payment_failed', 'boleto_issued', 'shipped', 'delivered', 'cancelled', 'refunded', 'refund_partial', 'return_requested', 'return_resolved')
  order by e.at;
$$;
grant execute on function public.my_order_timeline(bigint) to authenticated;
