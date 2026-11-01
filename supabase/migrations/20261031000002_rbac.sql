-- 0002 RBAC: roles, permissions, admin users and permission functions
create table public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('superadmin', 'admin', 'editor')),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger admin_roles_updated before update on public.admin_roles for each row execute function public.set_updated_at();

create table public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z]+\.[a-z]+$'),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger admin_permissions_updated before update on public.admin_permissions for each row execute function public.set_updated_at();

create table public.admin_role_permissions (
  role_id uuid not null references public.admin_roles (id) on delete cascade,
  permission_id uuid not null references public.admin_permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);
create index admin_role_permissions_permission_idx on public.admin_role_permissions (permission_id);

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role_id uuid not null references public.admin_roles (id) on delete restrict,
  active boolean not null default true,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index admin_users_role_idx on public.admin_users (role_id);
create index admin_users_invited_by_idx on public.admin_users (invited_by);
create trigger admin_users_updated before update on public.admin_users for each row execute function public.set_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid() and au.active
  );
$$;

create or replace function public.has_admin_permission(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.admin_users au
    join public.admin_role_permissions rp on rp.role_id = au.role_id
    join public.admin_permissions ap on ap.id = rp.permission_id
    where au.user_id = auth.uid() and au.active and ap.key = p
  );
$$;

-- permission keys for the current admin (used by the app to build its context in one call)
create or replace function public.my_admin_context() returns table (role_key text, permissions text[], active boolean)
language sql stable security definer set search_path = public as $$
  select r.key, coalesce(array_agg(ap.key order by ap.key) filter (where ap.key is not null), '{}'), au.active
  from public.admin_users au
  join public.admin_roles r on r.id = au.role_id
  left join public.admin_role_permissions rp on rp.role_id = au.role_id
  left join public.admin_permissions ap on ap.id = rp.permission_id
  where au.user_id = auth.uid()
  group by r.key, au.active;
$$;
