-- 0016 sign-in → sign-up redirect: lets the server tell "no account" apart from "wrong password".
-- Callable by service_role only (never exposed to anon/authenticated clients).
create or replace function public.auth_email_exists(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where lower(email) = lower(trim(p_email)));
$$;

revoke all on function public.auth_email_exists(text) from public, anon, authenticated;
grant execute on function public.auth_email_exists(text) to service_role;
