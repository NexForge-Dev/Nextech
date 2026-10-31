-- 0011 pricing helpers (mirror src/lib/domain/pricing.ts) and search RPCs

-- Price a visitor may see for an offer, or null (link_only, inactive, stale fresh-integration price).
create or replace function public.offer_display_price(p_link uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select case
    when not l.active or l.price_minor is null then null
    when coalesce(s.price_display_policy, n.price_display_policy, 'show') = 'link_only' then null
    when n.adapter in ('amazon', 'amazon_paapi')
      and (l.price_source is distinct from 'integration' or l.price_updated_at is null or l.price_updated_at < now() - interval '24 hours')
      then null
    else l.price_minor
  end
  from public.affiliate_links l
  join public.stores s on s.id = l.store_id
  left join public.affiliate_networks n on n.id = coalesce(l.network_id, s.network_id)
  where l.id = p_link;
$$;

-- Proven previous price (history within 90 days before the current price, or verified manual).
create or replace function public.offer_proven_previous(p_link uuid) returns bigint
language sql stable security definer set search_path = public as $$
  with cur as (
    select l.id, public.offer_display_price(l.id) as price, coalesce(l.price_updated_at, now()) as set_at,
           l.previous_verified, l.previous_price_minor
    from public.affiliate_links l where l.id = p_link
  )
  select case
    when cur.price is null then null
    else coalesce(
      (select pp.price_minor from public.product_prices pp
        where pp.link_id = cur.id and pp.observed_at >= now() - interval '90 days'
          and pp.observed_at < cur.set_at and pp.price_minor > cur.price
        order by pp.observed_at desc limit 1),
      case when cur.previous_verified and cur.previous_price_minor > cur.price then cur.previous_price_minor end
    )
  end
  from cur;
$$;

-- Best displayable offer of a product in a market.
create or replace function public.product_market_price(p_product uuid, p_market text)
returns table (link_id uuid, price_minor bigint, currency text, previous_minor bigint, discount int)
language sql stable security definer set search_path = public as $$
  with best as (
    select l.id, public.offer_display_price(l.id) as price, l.currency
    from public.affiliate_links l
    where l.product_id = p_product and l.market = p_market and l.active
      and public.offer_display_price(l.id) is not null
    order by public.offer_display_price(l.id) asc, l.price_updated_at desc nulls last
    limit 1
  )
  select best.id, best.price, best.currency::text, prev.p,
         case when prev.p is not null and prev.p > best.price
           then nullif(round(((prev.p - best.price)::numeric / prev.p) * 100)::int, 0) end
  from best
  cross join lateral (select public.offer_proven_previous(best.id) as p) prev;
$$;

-- Prefix tsquery from free text: keeps only letters/digits, so user input can never break the syntax.
create or replace function public.prefix_tsquery(q text) returns tsquery
language sql immutable set search_path = public, extensions as $$
  select case when count(*) = 0 then null
    else to_tsquery('simple', string_agg(w || ':*', ' & '))
  end
  from (
    select w from regexp_split_to_table(lower(public.f_unaccent(left(coalesce(q, ''), 100))), '[^a-z0-9]+') as w
    where w <> '' limit 8
  ) words;
$$;

create or replace function public.product_popularity(p_product uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.analytics_events e where e.product_id = p_product and e.type = 'product_view' and not e.is_bot and e.occurred_at > now() - interval '30 days')
  + (select count(*) from public.affiliate_clicks c where c.product_id = p_product and not c.is_bot and c.occurred_at > now() - interval '30 days');
$$;

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
      and (params.qq is null or (params.tsq is not null and p.search_tsv @@ params.tsq))
      and (p_category is null or p.category_id = (select c.id from public.categories c where c.slug = p_category))
      and (p_brand is null or p.brand_id = (select b.id from public.brands b where b.slug = p_brand))
      and (p_store is null or exists (
        select 1 from public.affiliate_links l join public.stores s on s.id = l.store_id
        where l.product_id = p.id and l.active and l.market = p_market and s.slug = p_store))
      and (p_min_rating is null or p.rating >= p_min_rating)
  ),
  priced as (
    select b.*, mp.price_minor as best_price, mp.discount as disc,
      public.product_popularity(b.id) as pop,
      case when params.tsq is null then 0 else ts_rank(b.search_tsv, params.tsq) end as rnk
    from base b
    cross join params
    left join lateral public.product_market_price(b.id, p_market) mp on true
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

create or replace function public.suggest(q text, p_locale text, p_limit int default 8)
returns table (kind text, slug text, label text)
language sql stable security definer set search_path = public, extensions as $$
  with params as (
    select public.prefix_tsquery(q) as tsq,
           lower(public.f_unaccent(btrim(left(coalesce(q, ''), 100)))) as qn
  ),
  prods as (
    select 'product'::text as kind, p.slug,
      coalesce(
        (select t.name from public.product_translations t where t.product_id = p.id and t.locale = p_locale),
        (select t.name from public.product_translations t where t.product_id = p.id and t.locale = 'pt-BR'),
        (select t.name from public.product_translations t where t.product_id = p.id limit 1)
      ) as label,
      ts_rank(p.search_tsv, params.tsq) as score
    from public.products p, params
    where params.tsq is not null and p.status = 'published' and p.search_tsv @@ params.tsq
    order by score desc limit greatest(least(coalesce(p_limit, 8), 20), 1)
  ),
  brands_ as (
    select 'brand'::text as kind, b.slug, b.name as label
    from public.brands b, params
    where b.active and params.qn <> '' and lower(public.f_unaccent(b.name)) like replace(replace(replace(params.qn, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    limit 3
  ),
  cats as (
    select 'category'::text as kind, c.slug,
      coalesce(
        (select t.name from public.category_translations t where t.category_id = c.id and t.locale = p_locale),
        (select t.name from public.category_translations t where t.category_id = c.id and t.locale = 'pt-BR')
      ) as label
    from public.categories c, params
    where c.active and params.qn <> '' and exists (
      select 1 from public.category_translations t
      where t.category_id = c.id and lower(public.f_unaccent(t.name)) like replace(replace(replace(params.qn, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
    limit 3
  )
  select pr.kind, pr.slug, pr.label from prods pr
  union all select b2.kind, b2.slug, b2.label from brands_ b2
  union all select c2.kind, c2.slug, c2.label from cats c2;
$$;

grant execute on function public.search_products(text, text, text, text, text, text, bigint, bigint, numeric, boolean, text, int, int) to anon, authenticated;
grant execute on function public.suggest(text, text, int) to anon, authenticated;
grant execute on function public.product_market_price(uuid, text) to anon, authenticated;
