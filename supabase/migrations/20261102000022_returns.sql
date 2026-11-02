-- 0022 customer self-service: cancellation before the supplier purchase, return/support requests,
-- private buckets for return photos and invoices.

create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  reason text not null check (reason in ('withdrawal', 'defect', 'other')),
  message text not null check (char_length(message) between 5 and 2000),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 3),
  status text not null default 'open' check (status in ('open', 'resolved')),
  outcome text check (outcome in ('refund_full', 'refund_partial', 'replacement', 'refused')),
  outcome_note text check (char_length(outcome_note) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check ((status = 'resolved') = (outcome is not null))
);
create index return_requests_order on public.return_requests (order_id);
create index return_requests_open on public.return_requests (status, created_at);
alter table public.return_requests enable row level security;
-- customers read their own requests (outcome_note is written for them); writes only via RPCs
create policy return_requests_own_read on public.return_requests for select using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('returns', 'returns', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('invoices', 'invoices', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

-- return photos: a customer uploads and reads only inside their own folder (<user id>/...)
create policy returns_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'returns' and (storage.foldername(name))[1] = auth.uid()::text);
create policy returns_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'returns' and (storage.foldername(name))[1] = auth.uid()::text);
-- invoices are written/read by the server (service role) only; customers download through a signed URL

-- Customer cancellation: allowed only before any item was bought at a supplier (mirrors canCustomerCancel).
create or replace function public.customer_cancel_order(p_number bigint)
returns table (order_id uuid, previous_status text, payment_method text, payment_intent text, total_minor bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where number = p_number and user_id = auth.uid() for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if v_order.status not in ('awaiting_payment', 'paid', 'awaiting_supplier') then raise exception 'not_cancellable' using errcode = 'P0001'; end if;
  if exists (select 1 from order_items where order_items.order_id = v_order.id and supplier_purchased_at is not null) then
    raise exception 'already_purchased' using errcode = 'P0001';
  end if;
  update orders set status = 'cancelled', cancelled_at = now() where id = v_order.id;
  insert into order_events (order_id, actor, actor_id, kind, data) values (v_order.id, 'customer', auth.uid(), 'cancelled', jsonb_build_object('by', 'customer', 'previous', v_order.status));
  return query select v_order.id, v_order.status, v_order.payment_method, v_order.stripe_payment_intent_id, v_order.total_minor;
end $$;
revoke all on function public.customer_cancel_order(bigint) from public, anon;
grant execute on function public.customer_cancel_order(bigint) to authenticated;

create or replace function public.create_return_request(p_number bigint, p_reason text, p_message text, p_photos text[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_id uuid;
  v_path text;
begin
  select * into v_order from orders where number = p_number and user_id = auth.uid();
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if v_order.status in ('awaiting_payment', 'cancelled') then raise exception 'not_returnable' using errcode = 'P0001'; end if;
  if exists (select 1 from return_requests where return_requests.order_id = v_order.id and status = 'open') then raise exception 'already_open' using errcode = 'P0001'; end if;
  foreach v_path in array coalesce(p_photos, '{}') loop
    if split_part(v_path, '/', 1) <> auth.uid()::text then raise exception 'invalid_photo' using errcode = 'P0001'; end if;
  end loop;
  insert into return_requests (order_id, user_id, reason, message, photo_paths)
  values (v_order.id, auth.uid(), p_reason, btrim(p_message), coalesce(p_photos, '{}')) returning id into v_id;
  insert into order_events (order_id, actor, actor_id, kind, data) values (v_order.id, 'customer', auth.uid(), 'return_requested', jsonb_build_object('reason', p_reason));
  return v_id;
end $$;
revoke all on function public.create_return_request(bigint, text, text, text[]) from public, anon;
grant execute on function public.create_return_request(bigint, text, text, text[]) to authenticated;
