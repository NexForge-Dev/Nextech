-- 0005 marketing: campaigns, banners, promotions ("ofertas")
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_dates check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create trigger campaigns_updated before update on public.campaigns for each row execute function public.set_updated_at();

create table public.campaign_translations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  locale public.locale_code not null,
  title text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, locale)
);
create trigger campaign_translations_updated before update on public.campaign_translations for each row execute function public.set_updated_at();

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  mobile_image_path text,
  link_url text check (link_url ~ '^(https://|/)'),
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order int not null default 0,
  active boolean not null default false,
  campaign_id uuid references public.campaigns (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint banner_dates check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index banners_campaign_idx on public.banners (campaign_id);
create index banners_active_idx on public.banners (active, sort_order);
create trigger banners_updated before update on public.banners for each row execute function public.set_updated_at();

create table public.banner_translations (
  id uuid primary key default gen_random_uuid(),
  banner_id uuid not null references public.banners (id) on delete cascade,
  locale public.locale_code not null,
  title text not null check (char_length(title) between 1 and 120),
  subtitle text check (char_length(subtitle) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (banner_id, locale)
);
create trigger banner_translations_updated before update on public.banner_translations for each row execute function public.set_updated_at();

create table public.campaign_products (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  sort_order int not null default 0,
  primary key (campaign_id, product_id)
);
create index campaign_products_product_idx on public.campaign_products (product_id);

create table public.campaign_banners (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  banner_id uuid not null references public.banners (id) on delete cascade,
  primary key (campaign_id, banner_id)
);
create index campaign_banners_banner_idx on public.campaign_banners (banner_id);

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  link_id uuid references public.affiliate_links (id) on delete set null,
  reason text check (char_length(reason) <= 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  publish_at timestamptz,
  highlighted boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotion_dates check (ends_at > starts_at)
);
create index promotions_product_idx on public.promotions (product_id);
create index promotions_link_idx on public.promotions (link_id);
create index promotions_window_idx on public.promotions (active, starts_at, ends_at);
create trigger promotions_updated before update on public.promotions for each row execute function public.set_updated_at();
