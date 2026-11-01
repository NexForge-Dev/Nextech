-- 0004 affiliate networks, stores, offers (affiliate_links) and price history
create table public.affiliate_networks (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  adapter text not null check (adapter in ('amazon', 'amazon_paapi', 'awin', 'admitad', 'impact', 'generic')),
  name text not null check (char_length(name) between 1 and 80),
  subid_param text check (subid_param ~ '^[A-Za-z0-9_]{1,40}$'),
  price_display_policy text not null default 'show' check (price_display_policy in ('show', 'link_only')),
  settings jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger affiliate_networks_updated before update on public.affiliate_networks for each row execute function public.set_updated_at();

create table public.network_credentials (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null unique references public.affiliate_networks (id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  tag text not null,
  last4 text not null default '',
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index network_credentials_updated_by_idx on public.network_credentials (updated_by);
create trigger network_credentials_updated before update on public.network_credentials for each row execute function public.set_updated_at();

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  logo_path text,
  official_url text check (official_url ~ '^https://'),
  description text check (char_length(description) <= 2000),
  network_id uuid references public.affiliate_networks (id) on delete set null,
  markets text[] not null default '{}',
  price_display_policy text check (price_display_policy in ('show', 'link_only')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stores_network_idx on public.stores (network_id);
create trigger stores_updated before update on public.stores for each row execute function public.set_updated_at();

create table public.store_domains (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  domain text not null check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  created_at timestamptz not null default now(),
  unique (store_id, domain)
);

create table public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete restrict,
  network_id uuid references public.affiliate_networks (id) on delete set null,
  market public.market_code not null references public.markets (code),
  currency public.currency_code not null,
  original_url text not null check (original_url ~ '^https://'),
  affiliate_url text check (affiliate_url ~ '^https://'),
  external_id text check (char_length(external_id) <= 120),
  price_minor bigint check (price_minor >= 0),
  price_updated_at timestamptz,
  price_source public.source_kind,
  previous_price_minor bigint check (previous_price_minor >= 0),
  previous_verified boolean not null default false,
  previous_evidence text check (char_length(previous_evidence) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_needs_evidence check (not previous_verified or (previous_price_minor is not null and coalesce(previous_evidence, '') <> '')),
  constraint price_needs_source check (price_minor is null or price_source is not null)
);
create index affiliate_links_product_idx on public.affiliate_links (product_id);
create index affiliate_links_store_idx on public.affiliate_links (store_id);
create index affiliate_links_network_idx on public.affiliate_links (network_id);
create index affiliate_links_market_idx on public.affiliate_links (market, active);
create trigger affiliate_links_updated before update on public.affiliate_links for each row execute function public.set_updated_at();

create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.affiliate_links (id) on delete cascade,
  price_minor bigint not null check (price_minor >= 0),
  currency public.currency_code not null,
  observed_at timestamptz not null default now(),
  source public.source_kind not null,
  source_ref text check (char_length(source_ref) <= 200),
  created_at timestamptz not null default now()
);
create index product_prices_link_idx on public.product_prices (link_id, observed_at desc);
