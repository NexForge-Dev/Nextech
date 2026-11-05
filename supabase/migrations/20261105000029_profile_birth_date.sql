-- 0029 Date of birth, asked at checkout to confirm the buyer is an adult.
-- It lives on the profile only, on purpose: it is not copied into orders, so it goes away with the
-- account, stays out of the admin order screens and never reaches payment or delivery partners.
alter table public.profiles add column if not exists birth_date date check (birth_date >= date '1900-01-01');
comment on column public.profiles.birth_date is 'LGPD: adult check only. Never for marketing.';
notify pgrst, 'reload schema';
