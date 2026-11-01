-- 0012 public offer loader: effective price policy is resolved server-side so the
-- storefront can never show a price that the network's terms forbid.
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
  join public.products p on p.id = l.product_id and p.status = 'published'
  join public.stores s on s.id = l.store_id and s.active
  left join public.affiliate_networks n on n.id = coalesce(l.network_id, s.network_id)
  where l.product_id = any(p_ids) and l.active
    and cardinality(p_ids) <= 200;
$$;
grant execute on function public.product_offers(uuid[]) to anon, authenticated;
