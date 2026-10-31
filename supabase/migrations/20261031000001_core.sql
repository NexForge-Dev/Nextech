-- 0001 core: extensions, helpers, markets, profiles
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- immutable wrapper so unaccent can be used in indexes / generated columns
create or replace function public.f_unaccent(text) returns text
language sql immutable parallel safe strict
set search_path = public, extensions
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

create type public.source_kind as enum ('manual', 'import', 'integration');

create domain public.locale_code as text
  check (value in ('pt-BR', 'pt-PT', 'en', 'es'));

create domain public.currency_code as text
  check (value ~ '^[A-Z]{3}$');

create domain public.market_code as text
  check (value ~ '^[A-Z]{2}$');

create table public.markets (
  code public.market_code primary key,
  name_pt text not null,
  default_currency public.currency_code not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger markets_updated before update on public.markets for each row execute function public.set_updated_at();

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  preferred_locale public.locale_code,
  preferred_market public.market_code,
  history_enabled boolean not null default false,
  consent jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, preferred_locale)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), ''),
    case when new.raw_user_meta_data ->> 'locale' in ('pt-BR', 'pt-PT', 'en', 'es')
      then new.raw_user_meta_data ->> 'locale' else null end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
