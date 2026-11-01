-- 0015 data retention: raw clicks / views / searches older than 13 months become daily rollups.
create or replace function public.run_retention() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cutoff timestamptz := date_trunc('day', now() - interval '13 months');
  v_clicks bigint;
  v_views bigint;
  v_searches bigint;
begin
  insert into daily_rollups (day, metric, product_id, category_id, store_id, network_id, campaign_id, value)
  select (c.occurred_at at time zone 'America/Sao_Paulo')::date, 'clicks', c.product_id, p.category_id, c.store_id, c.network_id, c.campaign_id, count(*)
  from affiliate_clicks c left join products p on p.id = c.product_id
  where c.occurred_at < v_cutoff and not c.is_bot
  group by 1, 3, 4, 5, 6, 7
  on conflict (day, metric, coalesce(product_id, '00000000-0000-0000-0000-000000000000'), coalesce(category_id, '00000000-0000-0000-0000-000000000000'),
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'), coalesce(network_id, '00000000-0000-0000-0000-000000000000'), coalesce(campaign_id, '00000000-0000-0000-0000-000000000000'))
  do update set value = daily_rollups.value + excluded.value;
  delete from affiliate_clicks where occurred_at < v_cutoff and id not in (select click_id from affiliate_conversions where click_id is not null);
  get diagnostics v_clicks = row_count;

  insert into daily_rollups (day, metric, product_id, category_id, value)
  select (e.occurred_at at time zone 'America/Sao_Paulo')::date, 'views', e.product_id, coalesce(e.category_id, p.category_id), count(*)
  from analytics_events e left join products p on p.id = e.product_id
  where e.occurred_at < v_cutoff and not e.is_bot and e.type = 'product_view'
  group by 1, 3, 4
  on conflict (day, metric, coalesce(product_id, '00000000-0000-0000-0000-000000000000'), coalesce(category_id, '00000000-0000-0000-0000-000000000000'),
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'), coalesce(network_id, '00000000-0000-0000-0000-000000000000'), coalesce(campaign_id, '00000000-0000-0000-0000-000000000000'))
  do update set value = daily_rollups.value + excluded.value;
  delete from analytics_events where occurred_at < v_cutoff;
  get diagnostics v_views = row_count;

  delete from searches where occurred_at < v_cutoff;
  get diagnostics v_searches = row_count;
  delete from rate_limits where window_start < now() - interval '1 day';
  return jsonb_build_object('clicks', v_clicks, 'events', v_views, 'searches', v_searches, 'cutoff', v_cutoff);
end $$;
revoke all on function public.run_retention() from public, anon, authenticated;
