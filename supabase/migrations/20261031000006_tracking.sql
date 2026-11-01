-- 0006 tracking: append-only events, conversions, commissions, sync runs, rollups
create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  product_id uuid references public.products (id) on delete set null,
  link_id uuid references public.affiliate_links (id) on delete set null,
  store_id uuid references public.stores (id) on delete set null,
  network_id uuid references public.affiliate_networks (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  locale public.locale_code,
  market public.market_code,
  session_id text check (char_length(session_id) <= 64),
  referrer_path text check (char_length(referrer_path) <= 300),
  is_bot boolean not null default false
);
create index affiliate_clicks_time_idx on public.affiliate_clicks (occurred_at);
create index affiliate_clicks_product_idx on public.affiliate_clicks (product_id, occurred_at);
create index affiliate_clicks_link_idx on public.affiliate_clicks (link_id);
create index affiliate_clicks_store_idx on public.affiliate_clicks (store_id);
create index affiliate_clicks_network_idx on public.affiliate_clicks (network_id);
create index affiliate_clicks_campaign_idx on public.affiliate_clicks (campaign_id);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  type text not null check (type in ('product_view', 'search', 'category_view', 'home_view')),
  product_id uuid references public.products (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  locale public.locale_code,
  market public.market_code,
  session_id text check (char_length(session_id) <= 64),
  referrer_path text check (char_length(referrer_path) <= 300),
  is_bot boolean not null default false
);
create index analytics_events_time_idx on public.analytics_events (occurred_at);
create index analytics_events_product_idx on public.analytics_events (product_id, occurred_at);
create index analytics_events_category_idx on public.analytics_events (category_id);

create table public.searches (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  query text not null check (char_length(query) <= 100),
  locale public.locale_code,
  results int not null default 0,
  user_id uuid references auth.users (id) on delete set null
);
create index searches_time_idx on public.searches (occurred_at);
create index searches_user_idx on public.searches (user_id);

create table public.affiliate_conversions (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.affiliate_networks (id) on delete cascade,
  external_id text not null,
  click_id uuid references public.affiliate_clicks (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  occurred_at timestamptz not null,
  status text not null check (status in ('pending', 'confirmed', 'rejected')),
  sale_amount_minor bigint,
  currency public.currency_code,
  source public.source_kind not null,
  source_ref text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network_id, external_id)
);
create index affiliate_conversions_click_idx on public.affiliate_conversions (click_id);
create index affiliate_conversions_product_idx on public.affiliate_conversions (product_id);
create index affiliate_conversions_campaign_idx on public.affiliate_conversions (campaign_id);
create index affiliate_conversions_time_idx on public.affiliate_conversions (occurred_at);
create trigger affiliate_conversions_updated before update on public.affiliate_conversions for each row execute function public.set_updated_at();

create table public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.affiliate_networks (id) on delete cascade,
  external_id text not null,
  conversion_id uuid references public.affiliate_conversions (id) on delete set null,
  amount_minor bigint not null,
  currency public.currency_code not null,
  status text not null check (status in ('pending', 'confirmed', 'rejected')),
  reported_at timestamptz not null,
  source public.source_kind not null,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (network_id, external_id)
);
create index affiliate_commissions_conversion_idx on public.affiliate_commissions (conversion_id);
create index affiliate_commissions_time_idx on public.affiliate_commissions (reported_at);
create trigger affiliate_commissions_updated before update on public.affiliate_commissions for each row execute function public.set_updated_at();

create table public.network_sync_runs (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.affiliate_networks (id) on delete cascade,
  kind text not null default 'api' check (kind in ('api', 'csv', 'prices')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  inserted int not null default 0,
  updated int not null default 0,
  error text
);
create index network_sync_runs_network_idx on public.network_sync_runs (network_id, started_at desc);

create table public.daily_rollups (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  metric text not null,
  product_id uuid references public.products (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  store_id uuid references public.stores (id) on delete set null,
  network_id uuid references public.affiliate_networks (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  value bigint not null default 0
);
create unique index daily_rollups_key on public.daily_rollups (
  day, metric,
  coalesce(product_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(category_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(store_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(network_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(campaign_id, '00000000-0000-0000-0000-000000000000')
);
create index daily_rollups_product_idx on public.daily_rollups (product_id);
create index daily_rollups_category_idx on public.daily_rollups (category_id);
create index daily_rollups_store_idx on public.daily_rollups (store_id);
create index daily_rollups_network_idx on public.daily_rollups (network_id);
create index daily_rollups_campaign_idx on public.daily_rollups (campaign_id);
