-- 0021 order state transitions used by the Stripe webhook (service role only). Every function locks
-- the order row and only moves it forward, so duplicate or out-of-order events are no-ops.

create or replace function public.order_mark_paid(p_pi text, p_order uuid, p_fee bigint, p_summary text)
returns table (order_id uuid, transitioned boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where id = p_order and (stripe_payment_intent_id = p_pi or stripe_payment_intent_id is null) for update;
  if not found then return; end if;
  if v_order.status <> 'awaiting_payment' then
    -- late fee/summary still useful (e.g. paid event retried after a fee lookup failed)
    update orders set stripe_fee_minor = coalesce(stripe_fee_minor, p_fee), payment_summary = coalesce(payment_summary, p_summary) where id = v_order.id;
    return query select v_order.id, false;
    return;
  end if;
  update orders set status = 'awaiting_supplier', paid_at = now(), stripe_payment_intent_id = p_pi, stripe_fee_minor = p_fee, payment_summary = p_summary
  where id = v_order.id;
  insert into order_events (order_id, actor, kind, data) values (v_order.id, 'stripe', 'paid', jsonb_build_object('fee', p_fee, 'summary', p_summary));
  return query select v_order.id, true;
end $$;

create or replace function public.order_cancel_by_pi(p_pi text)
returns table (order_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from orders where stripe_payment_intent_id = p_pi and status = 'awaiting_payment' for update;
  if v_id is null then return; end if;
  update orders set status = 'cancelled', cancelled_at = now() where id = v_id;
  insert into order_events (order_id, actor, kind, data) values (v_id, 'stripe', 'cancelled', jsonb_build_object('reason', 'payment_canceled'));
  return query select v_id;
end $$;

create or replace function public.order_add_event_by_pi(p_pi text, p_kind text, p_data jsonb)
returns table (order_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from orders where stripe_payment_intent_id = p_pi;
  if v_id is null then return; end if;
  insert into order_events (order_id, actor, kind, data) values (v_id, 'stripe', p_kind, coalesce(p_data, '{}'::jsonb));
  return query select v_id;
end $$;

-- Record (or update) a refund and keep orders.refunded_minor/status in sync.
-- Stripe refunds are keyed by stripe_refund_id; manual refunds (boleto) have none.
create or replace function public.order_record_refund(
  p_order uuid, p_pi text, p_amount bigint, p_method text, p_stripe_refund text, p_status text, p_note text, p_actor uuid
) returns table (order_id uuid, fully_refunded boolean, changed boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_order orders%rowtype;
  v_prev text;
  v_total bigint;
  v_changed boolean := false;
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
      values (v_order.id, p_amount, p_method, p_stripe_refund, p_status, p_note, p_actor);
      v_changed := p_status = 'succeeded';
    elsif v_prev <> p_status then
      update order_refunds set status = p_status where stripe_refund_id = p_stripe_refund;
      v_changed := p_status = 'succeeded';
    end if;
  else
    insert into order_refunds (order_id, amount_minor, method, status, note, created_by)
    values (v_order.id, p_amount, p_method, coalesce(p_status, 'succeeded'), p_note, p_actor);
    v_changed := true;
  end if;

  select coalesce(sum(amount_minor), 0) into v_total from order_refunds where order_refunds.order_id = v_order.id and status = 'succeeded';
  if v_total > v_order.total_minor then raise exception 'refund_exceeds_total' using errcode = 'P0001'; end if;
  update orders set refunded_minor = v_total,
    status = case when v_total >= total_minor then 'refunded' else status end
  where id = v_order.id;
  if v_changed then
    insert into order_events (order_id, actor, actor_id, kind, data)
    values (v_order.id, case when p_actor is null then 'stripe' else 'admin' end, p_actor,
            case when v_total >= v_order.total_minor then 'refunded' else 'refund_partial' end,
            jsonb_build_object('amount', p_amount, 'method', p_method, 'total_refunded', v_total, 'note', p_note));
  end if;
  return query select v_order.id, v_total >= v_order.total_minor, v_changed;
end $$;

revoke all on function public.order_mark_paid(text, uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.order_cancel_by_pi(text) from public, anon, authenticated;
revoke all on function public.order_add_event_by_pi(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.order_record_refund(uuid, text, bigint, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.order_mark_paid(text, uuid, bigint, text) to service_role;
grant execute on function public.order_cancel_by_pi(text) to service_role;
grant execute on function public.order_add_event_by_pi(text, text, jsonb) to service_role;
grant execute on function public.order_record_refund(uuid, text, bigint, text, text, text, text, uuid) to service_role;
