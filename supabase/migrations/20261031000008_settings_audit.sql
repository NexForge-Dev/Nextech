-- 0008 settings, audit log, rate limiting
create table public.site_settings (
  key text primary key check (key ~ '^(public|ops)\.[a-z0-9_]+$'),
  value jsonb not null default 'null'::jsonb,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index site_settings_updated_by_idx on public.site_settings (updated_by);
create trigger site_settings_updated before update on public.site_settings for each row execute function public.set_updated_at();

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) <= 60),
  entity text not null check (char_length(entity) <= 60),
  entity_id text check (char_length(entity_id) <= 120),
  summary jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index admin_audit_log_time_idx on public.admin_audit_log (occurred_at desc);
create index admin_audit_log_actor_idx on public.admin_audit_log (actor_id);
create index admin_audit_log_entity_idx on public.admin_audit_log (entity, entity_id);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null default 0
);

-- Atomic fixed-window counter. Returns true while the caller is within the limit.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds int, p_max int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rl.count + 1 end,
    window_start = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then now() else rl.window_start end
  returning count into v_count;
  -- opportunistic cleanup of stale keys
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_count <= p_max;
end $$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
