-- 0003 catalogue: brands, categories, tags, products, translations, images
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  logo_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger brands_updated before update on public.brands for each row execute function public.set_updated_at();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  icon text not null default 'Package',
  image_path text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_active_sort_idx on public.categories (active, sort_order);
create trigger categories_updated before update on public.categories for each row execute function public.set_updated_at();

create table public.category_translations (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  locale public.locale_code not null,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, locale)
);
create trigger category_translations_updated before update on public.category_translations for each row execute function public.set_updated_at();

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tags_updated before update on public.tags for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  brand_id uuid references public.brands (id) on delete set null,
  category_id uuid not null references public.categories (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  featured boolean not null default false,
  sku text check (char_length(sku) <= 80),
  external_id text check (char_length(external_id) <= 120),
  rating numeric(2, 1) check (rating between 0 and 5),
  rating_count int check (rating_count >= 0),
  rating_source text check (char_length(rating_source) <= 80),
  rating_source_kind public.source_kind,
  specs jsonb not null default '[]'::jsonb check (jsonb_typeof(specs) = 'array'),
  published_at timestamptz,
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rating_needs_source check (rating is null or rating_source is not null)
);
create index products_brand_idx on public.products (brand_id);
create index products_category_idx on public.products (category_id);
create index products_status_idx on public.products (status, published_at desc);
create index products_featured_idx on public.products (featured) where featured;
create index products_search_idx on public.products using gin (search_tsv);
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();

create table public.product_translations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  locale public.locale_code not null,
  name text not null check (char_length(name) between 2 and 160),
  short_description text check (char_length(short_description) <= 280),
  description_md text check (char_length(description_md) <= 20000),
  specs_i18n jsonb not null default '[]'::jsonb check (jsonb_typeof(specs_i18n) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, locale)
);
create index product_translations_name_trgm on public.product_translations using gin (public.f_unaccent(lower(name)) extensions.gin_trgm_ops);
create trigger product_translations_updated before update on public.product_translations for each row execute function public.set_updated_at();

create table public.product_tags (
  product_id uuid not null references public.products (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (product_id, tag_id)
);
create index product_tags_tag_idx on public.product_tags (tag_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null,
  alt text check (char_length(alt) <= 200),
  sort_order int not null default 0,
  is_main boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort_order);
create unique index product_images_one_main on public.product_images (product_id) where is_main;
create trigger product_images_updated before update on public.product_images for each row execute function public.set_updated_at();

-- full-text document: pt-BR name (A) + all names (A) + brand (B) + tags (C) + category names (C)
create or replace function public.refresh_product_search(p_product uuid) returns void
language sql security definer set search_path = public, extensions as $$
  update public.products p set search_tsv =
    setweight(to_tsvector('simple', public.f_unaccent(coalesce((select string_agg(t.name, ' ') from public.product_translations t where t.product_id = p.id), ''))), 'A') ||
    setweight(to_tsvector('simple', public.f_unaccent(coalesce((select b.name from public.brands b where b.id = p.brand_id), ''))), 'B') ||
    setweight(to_tsvector('simple', public.f_unaccent(coalesce((select string_agg(tg.name, ' ') from public.product_tags pt join public.tags tg on tg.id = pt.tag_id where pt.product_id = p.id), ''))), 'C') ||
    setweight(to_tsvector('simple', public.f_unaccent(coalesce((select string_agg(ct.name, ' ') from public.category_translations ct where ct.category_id = p.category_id), ''))), 'C') ||
    setweight(to_tsvector('simple', public.f_unaccent(coalesce(p.sku, ''))), 'D')
  where p.id = p_product;
$$;

create or replace function public.tg_product_search() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'products' then
    if tg_op = 'INSERT' or new.brand_id is distinct from old.brand_id or new.category_id is distinct from old.category_id or new.sku is distinct from old.sku then
      perform public.refresh_product_search(new.id);
    end if;
  elsif tg_table_name in ('product_translations', 'product_tags') then
    perform public.refresh_product_search(coalesce(new.product_id, old.product_id));
  elsif tg_table_name = 'brands' then
    perform public.refresh_product_search(p.id) from public.products p where p.brand_id = coalesce(new.id, old.id);
  elsif tg_table_name = 'category_translations' then
    perform public.refresh_product_search(p.id) from public.products p where p.category_id = coalesce(new.category_id, old.category_id);
  end if;
  return null;
end $$;

create trigger products_search after insert or update on public.products for each row execute function public.tg_product_search();
create trigger product_translations_search after insert or update or delete on public.product_translations for each row execute function public.tg_product_search();
create trigger product_tags_search after insert or delete on public.product_tags for each row execute function public.tg_product_search();
create trigger brands_search after update of name on public.brands for each row execute function public.tg_product_search();
create trigger category_translations_search after insert or update or delete on public.category_translations for each row execute function public.tg_product_search();
