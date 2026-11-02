-- 0025 audit fixes (2026-11-02):
--  1. internal SECURITY DEFINER helpers are no longer callable through the public API
--     (refresh_product_search wrote to products with RLS bypassed; the price/popularity helpers
--     leaked draft prices and view counts by id). They are still used by the definer functions
--     and triggers that call them, which run as the owner.
--  2. product_market_price only answers for published products (admins keep full access).
--  3. a refunded order cannot get a new return request.

-- 1. -----------------------------------------------------------------------------------------
revoke all on function public.refresh_product_search(uuid) from public, anon, authenticated;
revoke all on function public.offer_display_price(uuid) from public, anon, authenticated;
revoke all on function public.offer_proven_previous(uuid) from public, anon, authenticated;
revoke all on function public.product_popularity(uuid) from public, anon, authenticated;

-- 2. same signature and body as 0011, gated on the product being public -----------------------
create or replace function public.product_market_price(p_product uuid, p_market text)
returns table (link_id uuid, price_minor bigint, currency text, previous_minor bigint, discount int)
language sql stable security definer set search_path = public as $$
  with best as (
    select l.id, public.offer_display_price(l.id) as price, l.currency
    from public.affiliate_links l
    where l.product_id = p_product and l.market = p_market and l.active
      and (public.product_is_public(p_product) or public.is_admin())
      and public.offer_display_price(l.id) is not null
    order by public.offer_display_price(l.id) asc, l.price_updated_at desc nulls last
    limit 1
  )
  select best.id, best.price, best.currency::text, prev.p,
         case when prev.p is not null and prev.p > best.price
           then nullif(round(((prev.p - best.price)::numeric / prev.p) * 100)::int, 0) end
  from best
  cross join lateral (select public.offer_proven_previous(best.id) as p) prev;
$$;

-- 3. same signature as 0022 --------------------------------------------------------------------
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
  if v_order.status in ('awaiting_payment', 'cancelled', 'refunded') then raise exception 'not_returnable' using errcode = 'P0001'; end if;
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
