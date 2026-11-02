-- 0018 storefront gating: hide products whose business model is switched off and price own-store
-- products from product_sale. Same signatures as 0011/0012 (drop-in replacements).

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
      and public.business_model_enabled(p.sale_mode)
      and (p.sale_mode <> 'own' or p_market = 'BR')
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
      case when b.sale_mode = 'own' then ps.price_minor else mp.price_minor end as best_price,
      case when b.sale_mode = 'own' then
        case when ps.compare_at_minor > ps.price_minor
          then nullif(round(((ps.compare_at_minor - ps.price_minor)::numeric / ps.compare_at_minor) * 100)::int, 0) end
        else mp.discount end as disc,
      public.product_popularity(b.id) as pop,
      case when params.tsq is null then 0 else ts_rank(b.search_tsv, params.tsq) end as rnk
    from base b
    cross join params
    left join lateral public.product_market_price(b.id, p_market) mp on b.sale_mode = 'affiliate'
    left join public.product_sale ps on ps.product_id = b.id and b.sale_mode = 'own'
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
      and public.business_model_enabled(p.sale_mode)
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

create or replace function public.product_offers(p_ids uuid[])
returns table (
  id uuid, product_id uuid, store_id uuid, store_slug text, store_name text, store_logo text,
  network_id uuid, network_adapter text, market text, currency text,
  price_minor bigint, price_updated_at timestamptz, price_source public.source_kind,
  previous_price_minor bigint, previous_verified boolean,
  policy text, requires_fresh boolean, history jsonb
)
language sql stable security definer set search_path = public as $$
  select l.id, l.product_id, s.id, s.slug, s.name, s.logo_path,
    n.id, n.adapter, l.market::text, l.currency::text,
    l.price_minor, l.price_updated_at, l.price_source,
    l.previous_price_minor, l.previous_verified,
    coalesce(s.price_display_policy, n.price_display_policy, 'show'),
    coalesce(n.adapter in ('amazon', 'amazon_paapi'), false),
    coalesce((
      select jsonb_agg(jsonb_build_object('priceMinor', pp.price_minor, 'observedAt', pp.observed_at) order by pp.observed_at desc)
      from (
        select price_minor, observed_at from public.product_prices
        where link_id = l.id and observed_at >= now() - interval '90 days'
        order by observed_at desc limit 50
      ) pp
    ), '[]'::jsonb)
  from public.affiliate_links l
  join public.products p on p.id = l.product_id and p.status = 'published' and p.sale_mode = 'affiliate'
  join public.stores s on s.id = l.store_id and s.active
  left join public.affiliate_networks n on n.id = coalesce(l.network_id, s.network_id)
  where l.product_id = any(p_ids) and l.active
    and cardinality(p_ids) <= 200
    and public.business_model_enabled('affiliate');
$$;

grant execute on function public.business_model_enabled(text) to anon, authenticated;
grant execute on function public.product_mode_enabled(uuid) to anon, authenticated;
