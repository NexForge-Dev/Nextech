-- 0029 timed promotion on an own product: a promo price valid from one instant to another. The
-- regular price stays in price_minor, so the product returns to it by itself when the time is up.
-- Checkout and search read the same rule as the storefront, so the countdown is never just a label.

alter table public.product_sale
  add column if not exists promo_price_minor bigint check (promo_price_minor is null or promo_price_minor > 0),
  add column if not exists promo_starts_at timestamptz,
  add column if not exists promo_ends_at timestamptz;
alter table public.product_sale drop constraint if exists product_sale_promo_complete;
alter table public.product_sale add constraint product_sale_promo_complete check (
  (promo_price_minor is null and promo_starts_at is null and promo_ends_at is null)
  or (promo_price_minor is not null and promo_starts_at is not null and promo_ends_at is not null and promo_ends_at > promo_starts_at)
);

-- mirrors ownSaleNow() in src/lib/domain/own-pricing.ts; a promo above the price (the price was lowered later) never applies
create or replace function public.promo_running(p_price bigint, p_promo bigint, p_starts timestamptz, p_ends timestamptz) returns boolean
language sql stable set search_path = public as $$
  select coalesce(p_promo < p_price and now() >= p_starts and now() < p_ends, false);
$$;

-- Wraps admin_save_product_full so the promo lands in the same transaction without redefining it.
create or replace function public.admin_save_product_promo(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := public.admin_save_product_full(p);
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

-- order creation (same signature as 0026): charges the promo price while it runs
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
  -- at most 10 unpaid orders per hour per customer, serialised per user so a burst cannot slip through
  perform pg_advisory_xact_lock(hashtext('create_order:' || v_user::text));
  if (select count(*) from orders o where o.user_id = v_user and o.status = 'awaiting_payment' and o.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too_many_orders' using errcode = 'P0001';
  end if;
  select email into v_email from auth.users where id = v_user;
  select value into v_models from site_settings where key = 'public.business_models';
  if not coalesce((v_models ->> 'own_store')::boolean, true) then raise exception 'store_closed' using errcode = 'P0001'; end if;
  if p_method not in ('card', 'boleto', 'pix') or not coalesce((v_models -> 'payments' ->> p_method)::boolean, p_method <> 'pix') then
    raise exception 'method_disabled' using errcode = 'P0001';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'cart_empty' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'cart_too_large' using errcode = 'P0001'; end if;

  create temp table _lines (product_id uuid, name text, slug text, image_path text, price bigint, pct numeric, qty int, taken int) on commit drop;
  for v_item in select * from jsonb_array_elements(p_items) loop
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

-- search (same signature as 0026): filters, sorts and shows the discount by the current price
create or replace function public.search_products(
  q text,
  p_locale text,
  p_market text,
  p_category text default null,
  p_brand text default null,
  p_store text default null,
  p_min_minor bigint default null,
  p_max_minor bigint default null,
  p_min_rating numeric default null,
  p_proven_discount boolean default false,
  p_sort text default 'recent',
  p_limit int default 24,
  p_offset int default 0
)
returns table (
  id uuid, slug text, name text, brand_name text, category_id uuid, rating numeric, rating_count int, rating_source text,
  published_at timestamptz, best_price_minor bigint, discount int, popularity bigint, rank real, total_count bigint
)
language sql stable security definer set search_path = public, extensions as $$
  with params as (
    select nullif(btrim(left(coalesce(q, ''), 100)), '') as qq,
           public.prefix_tsquery(q) as tsq
  ),
  base as (
    select p.*,
      coalesce(
        (select t.name from public.product_translations t where t.product_id = p.id and t.locale = p_locale),
        (select t.name from public.product_translations t where t.product_id = p.id and t.locale = 'pt-BR'),
        (select t.name from public.product_translations t where t.product_id = p.id order by t.created_at limit 1)
      ) as display_name,
      (select b.name from public.brands b where b.id = p.brand_id) as b_name
    from public.products p, params
    where p.status = 'published'
      and public.product_mode_enabled(p.id)
      and (p.sale_mode <> 'own' or p_market = 'BR')
      and (p.sale_mode <> 'own' or exists (select 1 from public.product_sale ps0 where ps0.product_id = p.id))
      and (params.qq is null or (params.tsq is not null and p.search_tsv @@ params.tsq))
      and (p_category is null or p.category_id = (select c.id from public.categories c where c.slug = p_category))
      and (p_brand is null or p.brand_id = (select b.id from public.brands b where b.slug = p_brand))
      and (p_store is null or p.sale_mode = 'affiliate' and exists (
        select 1 from public.affiliate_links l join public.stores s on s.id = l.store_id
        where l.product_id = p.id and l.active and l.market = p_market and s.slug = p_store))
      and (p_min_rating is null or p.rating >= p_min_rating)
  ),
  priced as (
    select b.*,
      case when b.sale_mode <> 'own' then mp.price_minor when pr.running then ps.promo_price_minor else ps.price_minor end as best_price,
      case when b.sale_mode = 'own' then
        case when pr.running then nullif(round(((ps.price_minor - ps.promo_price_minor)::numeric / ps.price_minor) * 100)::int, 0)
          when ps.compare_at_minor > ps.price_minor
          then nullif(round(((ps.compare_at_minor - ps.price_minor)::numeric / ps.compare_at_minor) * 100)::int, 0) end
        else mp.discount end as disc,
      public.product_popularity(b.id) as pop,
      case when params.tsq is null then 0 else ts_rank(b.search_tsv, params.tsq) end as rnk
    from base b
    cross join params
    left join lateral public.product_market_price(b.id, p_market) mp on b.sale_mode = 'affiliate'
    left join public.product_sale ps on ps.product_id = b.id and b.sale_mode = 'own'
    left join lateral (select public.promo_running(ps.price_minor, ps.promo_price_minor, ps.promo_starts_at, ps.promo_ends_at) as running) pr on true
  ),
  filtered as (
    select * from priced
    where (p_min_minor is null or best_price >= p_min_minor)
      and (p_max_minor is null or best_price <= p_max_minor)
      and (not coalesce(p_proven_discount, false) or disc is not null)
  )
  select f.id, f.slug, f.display_name, f.b_name, f.category_id, f.rating, f.rating_count, f.rating_source,
         f.published_at, f.best_price, f.disc, f.pop, f.rnk::real, count(*) over () as total_count
  from filtered f
  order by
    case when p_sort = 'price_asc' then f.best_price end asc nulls last,
    case when p_sort = 'price_desc' then f.best_price end desc nulls last,
    case when p_sort = 'popular' then f.pop end desc nulls last,
    case when p_sort = 'discount' then f.disc end desc nulls last,
    case when p_sort = 'relevance' then f.rnk end desc nulls last,
    f.published_at desc nulls last,
    f.id
  limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
