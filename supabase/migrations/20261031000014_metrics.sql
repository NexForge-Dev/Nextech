-- 0014 metrics for the admin dashboard / analytics (SECURITY INVOKER: RLS requires analytics.read).
-- Raw events are used for the last 13 months; older periods read daily_rollups (filled by the retention job).

create or replace function public.metrics_clicks(
  p_from timestamptz, p_to timestamptz, p_group text,
  p_product uuid default null, p_category uuid default null, p_campaign uuid default null, p_network uuid default null
) returns table (key text, label text, value bigint)
language sql stable security invoker set search_path = public as $$
  with c as (
    select ac.*, p.category_id
    from affiliate_clicks ac
    left join products p on p.id = ac.product_id
    where ac.occurred_at >= p_from and ac.occurred_at <= p_to and not ac.is_bot
      and (p_product is null or ac.product_id = p_product)
      and (p_category is null or p.category_id = p_category)
      and (p_campaign is null or ac.campaign_id = p_campaign)
      and (p_network is null or ac.network_id = p_network)
  ),
  r as (
    select dr.day, dr.product_id, dr.category_id, dr.store_id, dr.network_id, dr.campaign_id, dr.value
    from daily_rollups dr
    where dr.metric = 'clicks' and dr.day >= (p_from at time zone 'America/Sao_Paulo')::date and dr.day <= (p_to at time zone 'America/Sao_Paulo')::date
      and dr.day < ((now() - interval '13 months') at time zone 'America/Sao_Paulo')::date
      and (p_product is null or dr.product_id = p_product)
      and (p_category is null or dr.category_id = p_category)
      and (p_campaign is null or dr.campaign_id = p_campaign)
      and (p_network is null or dr.network_id = p_network)
  ),
  unioned as (
    select (occurred_at at time zone 'America/Sao_Paulo')::date as day, product_id, category_id, store_id, network_id, campaign_id, 1::bigint as value from c
    union all
    select day, product_id, category_id, store_id, network_id, campaign_id, value from r
  )
  select
    case p_group
      when 'day' then u.day::text when 'product' then u.product_id::text when 'category' then u.category_id::text
      when 'store' then u.store_id::text when 'network' then u.network_id::text when 'campaign' then u.campaign_id::text else 'all' end,
    case p_group
      when 'day' then u.day::text
      when 'product' then coalesce((select t.name from product_translations t where t.product_id = u.product_id and t.locale = 'pt-BR'), 'Produto removido')
      when 'category' then coalesce((select t.name from category_translations t where t.category_id = u.category_id and t.locale = 'pt-BR'), 'Sem categoria')
      when 'store' then coalesce((select s.name from stores s where s.id = u.store_id), 'Loja removida')
      when 'network' then coalesce((select n.name from affiliate_networks n where n.id = u.network_id), 'Sem rede (link manual)')
      when 'campaign' then coalesce((select ca.name from campaigns ca where ca.id = u.campaign_id), 'Sem campanha')
      else 'Total' end,
    sum(u.value)::bigint
  from unioned u
  group by 1, 2
  order by case when p_group = 'day' then 1 else 0 end, 3 desc;
$$;

create or replace function public.metrics_views(
  p_from timestamptz, p_to timestamptz, p_group text,
  p_product uuid default null, p_category uuid default null
) returns table (key text, label text, value bigint)
language sql stable security invoker set search_path = public as $$
  with e as (
    select ae.*, coalesce(ae.category_id, p.category_id) as cat
    from analytics_events ae
    left join products p on p.id = ae.product_id
    where ae.occurred_at >= p_from and ae.occurred_at <= p_to and not ae.is_bot and ae.type = 'product_view'
      and (p_product is null or ae.product_id = p_product)
      and (p_category is null or p.category_id = p_category)
  )
  select
    case p_group when 'day' then (occurred_at at time zone 'America/Sao_Paulo')::date::text when 'product' then product_id::text when 'category' then cat::text else 'all' end,
    case p_group
      when 'day' then (occurred_at at time zone 'America/Sao_Paulo')::date::text
      when 'product' then coalesce((select t.name from product_translations t where t.product_id = e.product_id and t.locale = 'pt-BR'), 'Produto removido')
      when 'category' then coalesce((select t.name from category_translations t where t.category_id = e.cat and t.locale = 'pt-BR'), 'Sem categoria')
      else 'Total' end,
    count(*)::bigint
  from e
  group by 1, 2
  order by case when p_group = 'day' then 1 else 0 end, 3 desc;
$$;

create or replace function public.metrics_commissions(
  p_from timestamptz, p_to timestamptz, p_by_day boolean default false,
  p_product uuid default null, p_category uuid default null, p_campaign uuid default null, p_network uuid default null
) returns table (day text, status text, currency text, amount_minor bigint, conversions bigint)
language sql stable security invoker set search_path = public as $$
  select
    case when p_by_day then (cm.reported_at at time zone 'America/Sao_Paulo')::date::text else null end,
    cm.status, cm.currency, sum(cm.amount_minor)::bigint, count(distinct cm.conversion_id)::bigint
  from affiliate_commissions cm
  left join affiliate_conversions cv on cv.id = cm.conversion_id
  left join products p on p.id = cv.product_id
  where cm.reported_at >= p_from and cm.reported_at <= p_to
    and (p_product is null or cv.product_id = p_product)
    and (p_category is null or p.category_id = p_category)
    and (p_campaign is null or cv.campaign_id = p_campaign)
    and (p_network is null or cm.network_id = p_network)
  group by 1, 2, 3
  order by 1 nulls first, 2, 3;
$$;

create or replace function public.metrics_conversions_count(
  p_from timestamptz, p_to timestamptz,
  p_product uuid default null, p_category uuid default null, p_campaign uuid default null, p_network uuid default null
) returns bigint
language sql stable security invoker set search_path = public as $$
  select count(*) from affiliate_conversions cv left join products p on p.id = cv.product_id
  where cv.occurred_at >= p_from and cv.occurred_at <= p_to and cv.status <> 'rejected'
    and (p_product is null or cv.product_id = p_product)
    and (p_category is null or p.category_id = p_category)
    and (p_campaign is null or cv.campaign_id = p_campaign)
    and (p_network is null or cv.network_id = p_network);
$$;

grant execute on function public.metrics_clicks(timestamptz, timestamptz, text, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.metrics_views(timestamptz, timestamptz, text, uuid, uuid) to authenticated;
grant execute on function public.metrics_commissions(timestamptz, timestamptz, boolean, uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.metrics_conversions_count(timestamptz, timestamptz, uuid, uuid, uuid, uuid) to authenticated;
