-- 0029 payment integrity (QA 2026-11-05). Same signatures as before: safe to run twice and with the
-- previous code still running.
--  1. a confirmed payment is always recorded, whatever state the order is in (NXT-003, NXT-010);
--  2. a refund that fails after being confirmed reopens the order, and unknown Stripe refund
--     statuses count as pending instead of violating the check constraint (NXT-009, NXT-010);
--  3. an unpaid order can only be cancelled (NXT-003).

-- 1. same signature as 0023 ----------------------------------------------------------------------
create or replace function public.order_mark_paid(p_pi text, p_order uuid, p_fee bigint, p_summary text)
returns table (order_id uuid, transitioned boolean, was_cancelled boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where id = p_order and (stripe_payment_intent_id = p_pi or stripe_payment_intent_id is null) for update;
  if not found then return; end if;
  if v_order.status <> 'awaiting_payment' then
    update orders set stripe_fee_minor = coalesce(stripe_fee_minor, p_fee), payment_summary = coalesce(payment_summary, p_summary),
      paid_at = coalesce(paid_at, now()), stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_pi)
    where id = v_order.id;
    if v_order.paid_at is null then
      insert into order_events (order_id, actor, kind, data)
      values (v_order.id, 'stripe', case when v_order.status = 'cancelled' then 'paid_after_cancel' else 'paid' end, jsonb_build_object('fee', p_fee, 'summary', p_summary));
    end if;
    return query select v_order.id, false, (v_order.status = 'cancelled' and v_order.paid_at is null);
    return;
  end if;
  update orders set status = 'awaiting_supplier', paid_at = now(), stripe_payment_intent_id = p_pi, stripe_fee_minor = p_fee, payment_summary = p_summary
  where id = v_order.id;
  insert into order_events (order_id, actor, kind, data) values (v_order.id, 'stripe', 'paid', jsonb_build_object('fee', p_fee, 'summary', p_summary));
  return query select v_order.id, true, false;
end $$;

-- 2. same signature as 0021 ----------------------------------------------------------------------
create or replace function public.order_record_refund(
  p_order uuid, p_pi text, p_amount bigint, p_method text, p_stripe_refund text, p_status text, p_note text, p_actor uuid
) returns table (order_id uuid, fully_refunded boolean, changed boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_prev text;
  v_total bigint;
  v_changed boolean := false;
  v_status text := case when p_status in ('pending', 'succeeded', 'failed', 'canceled') then p_status when p_status is null then null else 'pending' end;
  v_new_status text;
begin
  if p_order is not null then
    select * into v_order from orders where id = p_order for update;
  else
    select * into v_order from orders where stripe_payment_intent_id = p_pi for update;
  end if;
  if not found then return; end if;

  if p_stripe_refund is not null then
    select status into v_prev from order_refunds where stripe_refund_id = p_stripe_refund;
    if v_prev is null then
      insert into order_refunds (order_id, amount_minor, method, stripe_refund_id, status, note, created_by)
      values (v_order.id, p_amount, p_method, p_stripe_refund, v_status, p_note, p_actor);
      v_changed := v_status = 'succeeded';
    elsif v_prev <> v_status then
      update order_refunds set status = v_status where stripe_refund_id = p_stripe_refund;
      v_changed := v_status = 'succeeded';
    end if;
  else
    insert into order_refunds (order_id, amount_minor, method, status, note, created_by)
    values (v_order.id, p_amount, p_method, coalesce(v_status, 'succeeded'), p_note, p_actor);
    v_changed := true;
  end if;

  select coalesce(sum(amount_minor), 0) into v_total from order_refunds where order_refunds.order_id = v_order.id and status = 'succeeded';
  if v_total > v_order.total_minor then raise exception 'refund_exceeds_total' using errcode = 'P0001'; end if;

  v_new_status := v_order.status;
  if v_total >= v_order.total_minor then
    v_new_status := 'refunded';
  elsif v_order.status = 'refunded' then
    -- the refund that closed this order did not go through: back to where it was
    v_new_status := case
      when v_order.cancelled_at is not null then 'cancelled'
      when v_order.paid_at is null then 'awaiting_payment'
      else coalesce(
        (select e.data ->> 'to' from order_events e
         where e.order_id = v_order.id and e.data ->> 'to' is not null and e.data ->> 'to' not in ('cancelled', 'refunded')
         order by e.at desc limit 1),
        'awaiting_supplier')
    end;
    insert into order_events (order_id, actor, actor_id, kind, data)
    values (v_order.id, 'stripe', p_actor, 'refund_reverted', jsonb_build_object('stripe_refund', p_stripe_refund, 'total_refunded', v_total, 'to', v_new_status));
  end if;
  update orders set refunded_minor = v_total, status = v_new_status where id = v_order.id;

  if v_changed then
    insert into order_events (order_id, actor, actor_id, kind, data)
    values (v_order.id, case when p_actor is null then 'stripe' else 'admin' end, p_actor,
            case when v_total >= v_order.total_minor then 'refunded' else 'refund_partial' end,
            jsonb_build_object('amount', p_amount, 'method', p_method, 'total_refunded', v_total, 'note', p_note));
  end if;
  return query select v_order.id, v_total >= v_order.total_minor, v_changed;
end $$;

-- 3. same signature as 0023 ----------------------------------------------------------------------
create or replace function public.admin_set_order_status(p_order uuid, p_expected text, p_to text, p_actor uuid, p_data jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_kind text;
begin
  select * into v_order from orders where id = p_order for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if v_order.status in ('cancelled', 'refunded') then raise exception 'order_closed' using errcode = 'P0001'; end if;
  if v_order.status <> p_expected then raise exception 'status_changed' using errcode = 'P0001'; end if;
  if p_to in ('awaiting_payment', 'paid') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  -- an unpaid order moves on only through the Stripe webhook
  if v_order.status = 'awaiting_payment' and p_to <> 'cancelled' then raise exception 'order_unpaid' using errcode = 'P0001'; end if;
  if p_to in ('shipped', 'in_transit', 'delivered') and exists (select 1 from order_items where order_id = p_order and coalesce(btrim(tracking_code), '') = '') then
    raise exception 'missing_tracking' using errcode = 'P0001';
  end if;
  update orders set status = p_to, cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end where id = p_order;
  v_kind := case when p_to in ('shipped', 'in_transit') then 'shipped' when p_to = 'delivered' then 'delivered' when p_to = 'cancelled' then 'cancelled' else 'status_changed' end;
  insert into order_events (order_id, actor, actor_id, kind, data)
  values (p_order, 'admin', p_actor, v_kind, jsonb_build_object('from', v_order.status, 'to', p_to) || coalesce(p_data, '{}'::jsonb));
end $$;

revoke all on function public.order_mark_paid(text, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.order_record_refund(uuid, text, bigint, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_set_order_status(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.order_mark_paid(text, uuid, bigint, text) to service_role;
grant execute on function public.order_record_refund(uuid, text, bigint, text, text, text, text, uuid) to service_role;
grant execute on function public.admin_set_order_status(uuid, text, text, uuid, jsonb) to service_role;
