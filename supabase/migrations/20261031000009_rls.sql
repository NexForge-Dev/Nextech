-- 0009 Row Level Security on every table
alter table public.markets enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.admin_role_permissions enable row level security;
alter table public.admin_users enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.category_translations enable row level security;
alter table public.tags enable row level security;
alter table public.products enable row level security;
alter table public.product_translations enable row level security;
alter table public.product_tags enable row level security;
alter table public.product_images enable row level security;
alter table public.affiliate_networks enable row level security;
alter table public.network_credentials enable row level security;
alter table public.stores enable row level security;
alter table public.store_domains enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.product_prices enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_translations enable row level security;
alter table public.banners enable row level security;
alter table public.banner_translations enable row level security;
alter table public.campaign_products enable row level security;
alter table public.campaign_banners enable row level security;
alter table public.promotions enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.analytics_events enable row level security;
alter table public.searches enable row level security;
alter table public.affiliate_conversions enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.network_sync_runs enable row level security;
alter table public.daily_rollups enable row level security;
alter table public.favorites enable row level security;
alter table public.browsing_history enable row level security;
alter table public.contact_messages enable row level security;
alter table public.admin_notification_reads enable row level security;
alter table public.site_settings enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.rate_limits enable row level security;
-- network_credentials and rate_limits intentionally have NO policies (service role only).

-- helper: is a product publicly visible?
create or replace function public.product_is_public(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.products where id = p and status = 'published');
$$;

create or replace function public.campaign_is_live(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.campaigns
    where id = c and status in ('active', 'scheduled')
      and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
  );
$$;

-- markets ---------------------------------------------------------------------------------
create policy markets_read on public.markets for select using (true);
create policy markets_write on public.markets for all using (public.has_admin_permission('stores.write')) with check (public.has_admin_permission('stores.write'));

-- profiles ---------------------------------------------------------------------------------
create policy profiles_own_read on public.profiles for select using (id = auth.uid() or public.has_admin_permission('customers.read'));
create policy profiles_own_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- RBAC -------------------------------------------------------------------------------------
create policy admin_roles_read on public.admin_roles for select using (public.is_admin());
create policy admin_roles_write on public.admin_roles for all using (public.has_admin_permission('admins.write')) with check (public.has_admin_permission('admins.write'));
create policy admin_permissions_read on public.admin_permissions for select using (public.is_admin());
create policy admin_role_permissions_read on public.admin_role_permissions for select using (public.is_admin());
create policy admin_role_permissions_write on public.admin_role_permissions for all using (public.has_admin_permission('admins.write')) with check (public.has_admin_permission('admins.write'));
create policy admin_users_read on public.admin_users for select using (public.is_admin());
create policy admin_users_write on public.admin_users for all using (public.has_admin_permission('admins.write')) with check (public.has_admin_permission('admins.write'));

-- catalogue --------------------------------------------------------------------------------
create policy brands_read on public.brands for select using (active or public.is_admin());
create policy brands_write on public.brands for all using (public.has_admin_permission('brands.write')) with check (public.has_admin_permission('brands.write'));

create policy categories_read on public.categories for select using (active or public.is_admin());
create policy categories_write on public.categories for all using (public.has_admin_permission('categories.write')) with check (public.has_admin_permission('categories.write'));
create policy category_translations_read on public.category_translations for select using (true);
create policy category_translations_write on public.category_translations for all using (public.has_admin_permission('categories.write')) with check (public.has_admin_permission('categories.write'));

create policy tags_read on public.tags for select using (true);
create policy tags_write on public.tags for all using (public.has_admin_permission('products.write')) with check (public.has_admin_permission('products.write'));

create policy products_read on public.products for select using (status = 'published' or public.is_admin());
create policy products_insert on public.products for insert with check (public.has_admin_permission('products.write'));
create policy products_update on public.products for update using (public.has_admin_permission('products.write')) with check (public.has_admin_permission('products.write'));
create policy products_delete on public.products for delete using (public.has_admin_permission('products.delete'));

create policy product_translations_read on public.product_translations for select using (public.product_is_public(product_id) or public.is_admin());
create policy product_translations_write on public.product_translations for all using (public.has_admin_permission('products.write')) with check (public.has_admin_permission('products.write'));
create policy product_tags_read on public.product_tags for select using (public.product_is_public(product_id) or public.is_admin());
create policy product_tags_write on public.product_tags for all using (public.has_admin_permission('products.write')) with check (public.has_admin_permission('products.write'));
create policy product_images_read on public.product_images for select using (public.product_is_public(product_id) or public.is_admin());
create policy product_images_write on public.product_images for all using (public.has_admin_permission('products.write')) with check (public.has_admin_permission('products.write'));

-- affiliates -------------------------------------------------------------------------------
create policy affiliate_networks_read on public.affiliate_networks for select using (active or public.is_admin());
create policy affiliate_networks_write on public.affiliate_networks for all using (public.has_admin_permission('networks.write')) with check (public.has_admin_permission('networks.write'));

create policy stores_read on public.stores for select using (active or public.is_admin());
create policy stores_write on public.stores for all using (public.has_admin_permission('stores.write')) with check (public.has_admin_permission('stores.write'));
create policy store_domains_read on public.store_domains for select using (public.is_admin());
create policy store_domains_write on public.store_domains for all using (public.has_admin_permission('stores.write')) with check (public.has_admin_permission('stores.write'));

create policy affiliate_links_read on public.affiliate_links for select using ((active and public.product_is_public(product_id)) or public.is_admin());
create policy affiliate_links_insert on public.affiliate_links for insert with check (public.has_admin_permission('links.write'));
create policy affiliate_links_update on public.affiliate_links for update using (public.has_admin_permission('links.write')) with check (public.has_admin_permission('links.write'));
create policy affiliate_links_delete on public.affiliate_links for delete using (public.has_admin_permission('links.delete'));

create policy product_prices_read on public.product_prices for select using (
  public.is_admin() or exists (select 1 from public.affiliate_links l where l.id = link_id and l.active and public.product_is_public(l.product_id))
);
create policy product_prices_insert on public.product_prices for insert with check (public.has_admin_permission('links.write'));

-- marketing --------------------------------------------------------------------------------
create policy campaigns_read on public.campaigns for select using (public.campaign_is_live(id) or public.is_admin());
create policy campaigns_write on public.campaigns for all using (public.has_admin_permission('marketing.write')) with check (public.has_admin_permission('marketing.write'));
create policy campaign_translations_read on public.campaign_translations for select using (public.campaign_is_live(campaign_id) or public.is_admin());
create policy campaign_translations_write on public.campaign_translations for all using (public.has_admin_permission('marketing.write')) with check (public.has_admin_permission('marketing.write'));
create policy campaign_products_read on public.campaign_products for select using (public.campaign_is_live(campaign_id) or public.is_admin());
create policy campaign_products_write on public.campaign_products for all using (public.has_admin_permission('marketing.write')) with check (public.has_admin_permission('marketing.write'));
create policy campaign_banners_read on public.campaign_banners for select using (public.campaign_is_live(campaign_id) or public.is_admin());
create policy campaign_banners_write on public.campaign_banners for all using (public.has_admin_permission('marketing.write')) with check (public.has_admin_permission('marketing.write'));

create policy banners_read on public.banners for select using (
  (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())) or public.is_admin()
);
create policy banners_write on public.banners for all using (public.has_admin_permission('marketing.write')) with check (public.has_admin_permission('marketing.write'));
create policy banner_translations_read on public.banner_translations for select using (true);
create policy banner_translations_write on public.banner_translations for all using (public.has_admin_permission('marketing.write')) with check (public.has_admin_permission('marketing.write'));

create policy promotions_read on public.promotions for select using (
  (active and starts_at <= now() and ends_at > now() and (publish_at is null or publish_at <= now()) and public.product_is_public(product_id))
  or public.is_admin()
);
create policy promotions_write on public.promotions for all using (public.has_admin_permission('marketing.write')) with check (public.has_admin_permission('marketing.write'));

-- tracking (inserted only by the service role) ----------------------------------------------
create policy affiliate_clicks_read on public.affiliate_clicks for select using (public.has_admin_permission('analytics.read'));
create policy analytics_events_read on public.analytics_events for select using (public.has_admin_permission('analytics.read'));
create policy searches_read on public.searches for select using (public.has_admin_permission('analytics.read'));
create policy daily_rollups_read on public.daily_rollups for select using (public.has_admin_permission('analytics.read'));
create policy affiliate_conversions_read on public.affiliate_conversions for select using (public.has_admin_permission('analytics.read'));
create policy affiliate_conversions_write on public.affiliate_conversions for all using (public.has_admin_permission('conversions.import')) with check (public.has_admin_permission('conversions.import'));
create policy affiliate_commissions_read on public.affiliate_commissions for select using (public.has_admin_permission('analytics.read'));
create policy affiliate_commissions_write on public.affiliate_commissions for all using (public.has_admin_permission('conversions.import')) with check (public.has_admin_permission('conversions.import'));
create policy network_sync_runs_read on public.network_sync_runs for select using (public.has_admin_permission('networks.read'));

-- user data --------------------------------------------------------------------------------
create policy favorites_own on public.favorites for select using (user_id = auth.uid());
create policy favorites_insert on public.favorites for insert with check (user_id = auth.uid() and public.product_is_public(product_id));
create policy favorites_delete on public.favorites for delete using (user_id = auth.uid());

create policy browsing_history_own on public.browsing_history for select using (user_id = auth.uid());
create policy browsing_history_insert on public.browsing_history for insert with check (
  user_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.history_enabled)
);
create policy browsing_history_delete on public.browsing_history for delete using (user_id = auth.uid());

create policy contact_messages_read on public.contact_messages for select using (public.has_admin_permission('customers.read'));
create policy contact_messages_update on public.contact_messages for update using (public.has_admin_permission('customers.read')) with check (public.has_admin_permission('customers.read'));

create policy admin_notification_reads_own on public.admin_notification_reads for all
  using (user_id = auth.uid() and public.is_admin()) with check (user_id = auth.uid() and public.is_admin());

-- settings & audit -------------------------------------------------------------------------
create policy site_settings_public_read on public.site_settings for select using (key like 'public.%' or public.is_admin());
create policy site_settings_write on public.site_settings for all using (public.has_admin_permission('settings.write')) with check (public.has_admin_permission('settings.write'));
create policy admin_audit_log_read on public.admin_audit_log for select using (public.has_admin_permission('audit.read'));
