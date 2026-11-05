-- 0027 suggestions and problem reports sent by signed-in customers from the store balloon.
-- Kept apart from contact_messages: these belong to an account and have their own workflow.
-- Rows are written by the server (service role) after it reads the user from the session, so
-- there is no insert policy. Deleting the account deletes its messages.

create table public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('suggestion', 'problem')),
  message text not null check (char_length(message) between 1 and 4000),
  page text not null default '' check (char_length(page) <= 300),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  created_at timestamptz not null default now()
);
create index product_feedback_status_idx on public.product_feedback (status, created_at desc);
create index product_feedback_user_idx on public.product_feedback (user_id);
alter table public.product_feedback enable row level security;

-- customers read their own (the data export needs it); admins follow contact_messages
create policy product_feedback_read on public.product_feedback for select using (user_id = auth.uid() or public.has_admin_permission('customers.read'));
create policy product_feedback_update on public.product_feedback for update using (public.has_admin_permission('customers.read')) with check (public.has_admin_permission('customers.read'));

-- customers.read is a reading permission: it may move the status, never rewrite what a customer said
revoke update on public.product_feedback from anon, authenticated;
grant update (status) on public.product_feedback to authenticated;
