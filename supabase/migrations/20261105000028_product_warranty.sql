-- Warranty offered with each product, set when it is registered ("12 meses"). Empty means only the
-- legal warranty applies, which the store policies already state.
alter table public.products add column if not exists warranty text
  check (warranty is null or char_length(warranty) between 1 and 120);

create or replace function public.admin_save_product_full(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
  v_mode text := coalesce(nullif(p ->> 'saleMode', ''), 'affiliate');
  v_sale jsonb := p -> 'sale';
  v_sup jsonb;
begin
  if v_mode not in ('own', 'affiliate') then raise exception 'invalid sale mode' using errcode = '22023'; end if;
  v_id := public.admin_save_product(p);

  update products set sale_mode = v_mode where id = v_id;
  -- a caller that does not send the field (CSV import) keeps what the product already has
  if p ? 'warranty' then
    update products set warranty = nullif(btrim(p ->> 'warranty'), '') where id = v_id;
  end if;

  if v_mode = 'own' then
    if v_sale is null or jsonb_typeof(v_sale) <> 'object' then raise exception 'own products need sale data' using errcode = '22023'; end if;
    if coalesce(v_sale ->> 'fulfillment', 'dropship') not in ('stock', 'dropship') then raise exception 'invalid fulfillment' using errcode = '22023'; end if;
    insert into product_sale (product_id, price_minor, compare_at_minor, pix_discount_pct, available, delivery_min_days, delivery_max_days, fulfillment, stock_quantity)
    values (
      v_id, (v_sale ->> 'priceMinor')::bigint, nullif(v_sale ->> 'compareAtMinor', '')::bigint,
      coalesce(nullif(v_sale ->> 'pixDiscountPct', '')::numeric, 0), coalesce((v_sale ->> 'available')::boolean, true),
      coalesce(nullif(v_sale ->> 'deliveryMinDays', '')::int, 3), coalesce(nullif(v_sale ->> 'deliveryMaxDays', '')::int, 7),
      coalesce(v_sale ->> 'fulfillment', 'dropship'), nullif(v_sale ->> 'stockQuantity', '')::int
    )
    on conflict (product_id) do update set
      price_minor = excluded.price_minor, compare_at_minor = excluded.compare_at_minor, pix_discount_pct = excluded.pix_discount_pct,
      available = excluded.available, delivery_min_days = excluded.delivery_min_days, delivery_max_days = excluded.delivery_max_days,
      fulfillment = excluded.fulfillment, stock_quantity = excluded.stock_quantity;
  end if;
  -- sale data of a product switched back to affiliate is kept (switching back restores it)

  delete from product_suppliers where product_id = v_id;
  for v_sup in select * from jsonb_array_elements(coalesce(p -> 'suppliers', '[]'::jsonb)) loop
    insert into product_suppliers (product_id, supplier_id, url, cost_minor, is_primary, notes)
    values (
      v_id, (v_sup ->> 'supplierId')::uuid, nullif(v_sup ->> 'url', ''), nullif(v_sup ->> 'costMinor', '')::bigint,
      coalesce((v_sup ->> 'isPrimary')::boolean, false), nullif(v_sup ->> 'notes', '')
    );
  end loop;

  return v_id;
end $$;
