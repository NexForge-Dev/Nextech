-- 0017 own store (loja própria): business-model switches, sale data and private suppliers.
-- Affiliate tables and functions are left untouched; this only adds and gates.

-- Business-model switches (read by storefront and SQL) ------------------------------------------
insert into public.site_settings (key, value) values
  ('public.business_models', '{"own_store": true, "affiliates": false, "payments": {"card": true, "boleto": true, "pix": false}}'::jsonb)
on conflict (key) do nothing;

create or replace function public.business_model_enabled(p_mode text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case p_mode
       when 'own' then (s.value ->> 'own_store')::boolean
       when 'affiliate' then (s.value ->> 'affiliates')::boolean
     end
     from public.site_settings s where s.key = 'public.business_models'),
    p_mode = 'own'
  );
$$;

-- Products: sale mode ---------------------------------------------------------------------------
alter table public.products add column if not exists sale_mode text not null default 'affiliate'
  check (sale_mode in ('own', 'affiliate'));

create or replace function public.product_mode_enabled(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.business_model_enabled(sale_mode) from public.products where id = p), false);
$$;

-- Own-store sale data (one row per own product) -------------------------------------------------
create table public.product_sale (
  product_id uuid primary key references public.products (id) on delete cascade,
  price_minor bigint not null check (price_minor > 0),
  compare_at_minor bigint check (compare_at_minor is null or compare_at_minor > price_minor),
  pix_discount_pct numeric(5, 2) not null default 0 check (pix_discount_pct >= 0 and pix_discount_pct <= 50),
  available boolean not null default true,
  delivery_min_days int not null default 3 check (delivery_min_days between 0 and 120),
  delivery_max_days int not null default 7 check (delivery_max_days between 0 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (delivery_max_days >= delivery_min_days)
);
create trigger product_sale_updated before update on public.product_sale for each row execute function public.set_updated_at();

-- Suppliers (owner-only) ------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.suppliers (slug, name) values
  ('amazon-br', 'Amazon BR'), ('mercado-livre', 'Mercado Livre'), ('aliexpress', 'AliExpress'), ('outro', 'Outro')
on conflict (slug) do nothing;

create table public.product_suppliers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id),
  url text check (url is null or url ~ '^https://'),
  cost_minor bigint check (cost_minor is null or cost_minor >= 0),
  is_primary boolean not null default false,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  unique (product_id, supplier_id)
);
create unique index product_suppliers_one_primary on public.product_suppliers (product_id) where is_primary;

alter table public.product_sale enable row level security;
alter table public.suppliers enable row level security;
alter table public.product_suppliers enable row level security;

create policy product_sale_read on public.product_sale for select using (public.product_is_public(product_id) or public.is_admin());
create policy product_sale_write on public.product_sale for all using (public.has_admin_permission('products.write')) with check (public.has_admin_permission('products.write'));
create policy suppliers_admin_read on public.suppliers for select using (public.is_admin());
create policy suppliers_write on public.suppliers for all using (public.has_admin_permission('products.write')) with check (public.has_admin_permission('products.write'));
create policy product_suppliers_admin_read on public.product_suppliers for select using (public.is_admin());
create policy product_suppliers_write on public.product_suppliers for all using (public.has_admin_permission('products.write')) with check (public.has_admin_permission('products.write'));

-- New analytics event types for the store funnel ------------------------------------------------
alter table public.analytics_events drop constraint if exists analytics_events_type_check;
alter table public.analytics_events add constraint analytics_events_type_check
  check (type in ('product_view', 'search', 'category_view', 'home_view', 'add_to_cart', 'begin_checkout', 'purchase'));

-- Order permissions (also in seed.sql for fresh stacks) -----------------------------------------
insert into public.admin_permissions (key, description) values
  ('orders.read', 'Ver pedidos, clientes compradores e devoluções'),
  ('orders.write', 'Atualizar pedidos, compras no fornecedor, rastreio e notas'),
  ('orders.refund', 'Reembolsar pedidos')
on conflict (key) do nothing;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p on p.key in ('orders.read', 'orders.write', 'orders.refund')
where r.key in ('superadmin', 'admin')
on conflict do nothing;
