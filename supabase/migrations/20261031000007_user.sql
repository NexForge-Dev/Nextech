-- 0007 user data and inbox
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index favorites_product_idx on public.favorites (product_id);

create table public.browsing_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  viewed_at timestamptz not null default now()
);
create index browsing_history_user_idx on public.browsing_history (user_id, viewed_at desc);
create index browsing_history_product_idx on public.browsing_history (product_id);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) <= 254),
  subject text check (char_length(subject) <= 160),
  body text not null check (char_length(body) between 10 and 5000),
  locale public.locale_code,
  handled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contact_messages_handled_idx on public.contact_messages (handled, created_at desc);
create trigger contact_messages_updated before update on public.contact_messages for each row execute function public.set_updated_at();

create table public.admin_notification_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_key text not null check (char_length(notification_key) <= 200),
  read_at timestamptz not null default now(),
  unique (user_id, notification_key)
);
