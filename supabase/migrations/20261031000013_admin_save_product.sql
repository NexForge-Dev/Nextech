-- 0013 atomic product save (security invoker: RLS + permissions of the calling admin apply)
create or replace function public.admin_save_product(p jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_status text := p ->> 'status';
  v_prev_status text;
  v_link jsonb;
  v_link_id uuid;
  v_old record;
  v_keep uuid[] := '{}';
  v_tag text;
  v_tag_id uuid;
  v_locale text;
  v_now timestamptz := now();
begin
  if v_id is not null then
    select status into v_prev_status from products where id = v_id;
    if not found then raise exception 'product not found' using errcode = 'P0002'; end if;
    update products set
      slug = p ->> 'slug',
      brand_id = nullif(p ->> 'brandId', '')::uuid,
      category_id = (p ->> 'categoryId')::uuid,
      status = v_status,
      featured = coalesce((p ->> 'featured')::boolean, false),
      sku = nullif(p ->> 'sku', ''),
      external_id = nullif(p ->> 'externalId', ''),
      rating = nullif(p ->> 'rating', '')::numeric,
      rating_count = nullif(p ->> 'ratingCount', '')::int,
      rating_source = nullif(p ->> 'ratingSource', ''),
      rating_source_kind = case when nullif(p ->> 'rating', '') is null then null else coalesce(nullif(p ->> 'ratingSourceKind', ''), 'manual')::source_kind end,
      specs = coalesce(p -> 'specs', '[]'::jsonb),
      published_at = case when v_status = 'published' and (published_at is null or v_prev_status <> 'published') then v_now else published_at end
    where id = v_id;
  else
    insert into products (slug, brand_id, category_id, status, featured, sku, external_id, rating, rating_count, rating_source, rating_source_kind, specs, published_at)
    values (
      p ->> 'slug', nullif(p ->> 'brandId', '')::uuid, (p ->> 'categoryId')::uuid, v_status, coalesce((p ->> 'featured')::boolean, false),
      nullif(p ->> 'sku', ''), nullif(p ->> 'externalId', ''), nullif(p ->> 'rating', '')::numeric, nullif(p ->> 'ratingCount', '')::int,
      nullif(p ->> 'ratingSource', ''),
      case when nullif(p ->> 'rating', '') is null then null else coalesce(nullif(p ->> 'ratingSourceKind', ''), 'manual')::source_kind end,
      coalesce(p -> 'specs', '[]'::jsonb), case when v_status = 'published' then v_now end
    ) returning id into v_id;
  end if;

  -- translations: upsert given locales, remove the others
  delete from product_translations where product_id = v_id and not (locale in (select jsonb_object_keys(p -> 'translations')));
  for v_locale in select jsonb_object_keys(p -> 'translations') loop
    insert into product_translations (product_id, locale, name, short_description, description_md, specs_i18n)
    values (
      v_id, v_locale, p -> 'translations' -> v_locale ->> 'name',
      nullif(p -> 'translations' -> v_locale ->> 'shortDescription', ''),
      nullif(p -> 'translations' -> v_locale ->> 'descriptionMd', ''),
      coalesce(p -> 'translations' -> v_locale -> 'specs', '[]'::jsonb)
    )
    on conflict (product_id, locale) do update set
      name = excluded.name, short_description = excluded.short_description,
      description_md = excluded.description_md, specs_i18n = excluded.specs_i18n;
  end loop;

  -- tags (created on the fly)
  delete from product_tags where product_id = v_id;
  for v_tag in select jsonb_array_elements_text(coalesce(p -> 'tags', '[]'::jsonb)) loop
    insert into tags (slug, name) values (v_tag, v_tag) on conflict (slug) do nothing;
    select id into v_tag_id from tags where slug = v_tag;
    insert into product_tags (product_id, tag_id) values (v_id, v_tag_id) on conflict do nothing;
  end loop;

  -- images: replace
  delete from product_images where product_id = v_id;
  insert into product_images (product_id, path, alt, is_main, sort_order)
  select v_id, img ->> 'path', nullif(img ->> 'alt', ''), coalesce((img ->> 'isMain')::boolean, false), (ord - 1)::int
  from jsonb_array_elements(coalesce(p -> 'images', '[]'::jsonb)) with ordinality as t(img, ord);

  -- offers: update existing (same product only), insert new, record price history on change
  for v_link in select * from jsonb_array_elements(coalesce(p -> 'offers', '[]'::jsonb)) loop
    v_link_id := nullif(v_link ->> 'id', '')::uuid;
    if v_link_id is not null then
      select price_minor, currency into v_old from affiliate_links where id = v_link_id and product_id = v_id;
      if not found then v_link_id := null; end if;
    end if;
    if v_link_id is null then
      insert into affiliate_links (product_id, store_id, network_id, market, currency, original_url, affiliate_url, external_id,
        price_minor, price_updated_at, price_source, previous_price_minor, previous_verified, previous_evidence, active)
      values (
        v_id, (v_link ->> 'storeId')::uuid, nullif(v_link ->> 'networkId', '')::uuid, v_link ->> 'market', v_link ->> 'currency',
        v_link ->> 'originalUrl', nullif(v_link ->> 'affiliateUrl', ''), nullif(v_link ->> 'externalId', ''),
        nullif(v_link ->> 'priceMinor', '')::bigint,
        case when nullif(v_link ->> 'priceMinor', '') is not null then v_now end,
        case when nullif(v_link ->> 'priceMinor', '') is not null then coalesce(nullif(v_link ->> 'priceSource', ''), 'manual')::source_kind end,
        nullif(v_link ->> 'previousPriceMinor', '')::bigint, coalesce((v_link ->> 'previousVerified')::boolean, false),
        nullif(v_link ->> 'previousEvidence', ''), coalesce((v_link ->> 'active')::boolean, true)
      ) returning id into v_link_id;
      if nullif(v_link ->> 'priceMinor', '') is not null then
        insert into product_prices (link_id, price_minor, currency, observed_at, source, source_ref)
        values (v_link_id, (v_link ->> 'priceMinor')::bigint, v_link ->> 'currency', v_now, coalesce(nullif(v_link ->> 'priceSource', ''), 'manual')::source_kind, nullif(v_link ->> 'sourceRef', ''));
      end if;
    else
      update affiliate_links set
        store_id = (v_link ->> 'storeId')::uuid,
        network_id = nullif(v_link ->> 'networkId', '')::uuid,
        market = v_link ->> 'market',
        currency = v_link ->> 'currency',
        original_url = v_link ->> 'originalUrl',
        affiliate_url = nullif(v_link ->> 'affiliateUrl', ''),
        external_id = nullif(v_link ->> 'externalId', ''),
        price_minor = nullif(v_link ->> 'priceMinor', '')::bigint,
        price_updated_at = case
          when nullif(v_link ->> 'priceMinor', '')::bigint is distinct from v_old.price_minor or (v_link ->> 'currency') <> v_old.currency then
            case when nullif(v_link ->> 'priceMinor', '') is null then null else v_now end
          else price_updated_at end,
        price_source = case
          when nullif(v_link ->> 'priceMinor', '') is null then null
          when nullif(v_link ->> 'priceMinor', '')::bigint is distinct from v_old.price_minor then coalesce(nullif(v_link ->> 'priceSource', ''), 'manual')::source_kind
          else price_source end,
        previous_price_minor = nullif(v_link ->> 'previousPriceMinor', '')::bigint,
        previous_verified = coalesce((v_link ->> 'previousVerified')::boolean, false),
        previous_evidence = nullif(v_link ->> 'previousEvidence', ''),
        active = coalesce((v_link ->> 'active')::boolean, true)
      where id = v_link_id;
      if nullif(v_link ->> 'priceMinor', '') is not null and ((v_link ->> 'priceMinor')::bigint is distinct from v_old.price_minor or (v_link ->> 'currency') <> v_old.currency) then
        insert into product_prices (link_id, price_minor, currency, observed_at, source, source_ref)
        values (v_link_id, (v_link ->> 'priceMinor')::bigint, v_link ->> 'currency', v_now, coalesce(nullif(v_link ->> 'priceSource', ''), 'manual')::source_kind, nullif(v_link ->> 'sourceRef', ''));
      end if;
    end if;
    v_keep := v_keep || v_link_id;
  end loop;

  if coalesce((p ->> 'replaceOffers')::boolean, true) then
    delete from affiliate_links where product_id = v_id and not (id = any(v_keep));
  end if;

  return v_id;
end $$;

grant execute on function public.admin_save_product(jsonb) to authenticated;
