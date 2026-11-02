-- NEXTECH seed: real configuration only (no fictional catalogue data).
-- Idempotent: safe to run on a fresh cloud project after `supabase db push`.

-- Roles ------------------------------------------------------------------------------------
insert into public.admin_roles (key, name) values
  ('superadmin', 'Superadministrador'),
  ('admin', 'Administrador'),
  ('editor', 'Editor')
on conflict (key) do nothing;

-- Permissions ------------------------------------------------------------------------------
insert into public.admin_permissions (key, description) values
  ('products.write', 'Criar e editar produtos, marcas de produto, tags e imagens'),
  ('products.delete', 'Excluir produtos'),
  ('products.import', 'Importar e exportar produtos em CSV'),
  ('links.write', 'Criar e editar links de afiliados e preços'),
  ('links.delete', 'Excluir links de afiliados'),
  ('stores.write', 'Gerenciar lojas parceiras e mercados'),
  ('categories.write', 'Gerenciar categorias'),
  ('brands.write', 'Gerenciar marcas'),
  ('networks.read', 'Ver redes de afiliados (sem credenciais)'),
  ('networks.write', 'Gerenciar redes de afiliados, credenciais e sincronização'),
  ('marketing.write', 'Gerenciar ofertas, banners e campanhas'),
  ('analytics.read', 'Ver analytics e exportar relatórios'),
  ('conversions.import', 'Importar conversões e comissões'),
  ('customers.read', 'Ver clientes e mensagens de contato'),
  ('customers.export', 'Exportar dados de clientes'),
  ('settings.write', 'Alterar configurações gerais e informações legais'),
  ('admins.write', 'Gerenciar administradores e perfis'),
  ('audit.read', 'Ver o log de auditoria'),
  ('orders.read', 'Ver pedidos, clientes compradores e devoluções'),
  ('orders.write', 'Atualizar pedidos, compras no fornecedor, rastreio e notas'),
  ('orders.refund', 'Reembolsar pedidos')
on conflict (key) do nothing;

-- Role × permission matrix (design §15.3) --------------------------------------------------
insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r cross join public.admin_permissions p
where r.key = 'superadmin'
on conflict do nothing;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p on p.key in (
  'products.write', 'products.delete', 'products.import', 'links.write', 'links.delete', 'stores.write',
  'categories.write', 'brands.write', 'networks.read', 'marketing.write', 'analytics.read',
  'conversions.import', 'customers.read', 'audit.read', 'orders.read', 'orders.write', 'orders.refund'
) where r.key = 'admin'
on conflict do nothing;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p on p.key in (
  'products.write', 'links.write', 'categories.write', 'brands.write', 'marketing.write'
) where r.key = 'editor'
on conflict do nothing;

-- Markets ----------------------------------------------------------------------------------
insert into public.markets (code, name_pt, default_currency, active) values
  ('BR', 'Brasil', 'BRL', true),
  ('PT', 'Portugal', 'EUR', true),
  ('US', 'Estados Unidos', 'USD', true),
  ('ES', 'Espanha', 'EUR', true),
  ('MX', 'México', 'MXN', false),
  ('AR', 'Argentina', 'ARS', false),
  ('CO', 'Colômbia', 'COP', false),
  ('CL', 'Chile', 'CLP', false),
  ('GB', 'Reino Unido', 'GBP', false)
on conflict (code) do nothing;

-- Initial categories (brief §4.2; "Ofertas" is the offers page, not a category) -------------
insert into public.categories (slug, icon, sort_order) values
  ('eletronicos', 'Tv', 10),
  ('informatica', 'Laptop', 20),
  ('smartphones', 'Smartphone', 30),
  ('casa-e-decoracao', 'Sofa', 40),
  ('eletrodomesticos', 'Refrigerator', 50),
  ('moda', 'Shirt', 60),
  ('beleza', 'Sparkles', 70),
  ('esportes', 'Dumbbell', 80),
  ('games', 'Gamepad2', 90),
  ('acessorios', 'Watch', 100)
on conflict (slug) do nothing;

insert into public.category_translations (category_id, locale, name)
select c.id, v.locale, v.name
from (values
  ('eletronicos', 'pt-BR', 'Eletrônicos'), ('eletronicos', 'pt-PT', 'Eletrónica'), ('eletronicos', 'en', 'Electronics'), ('eletronicos', 'es', 'Electrónica'),
  ('informatica', 'pt-BR', 'Informática'), ('informatica', 'pt-PT', 'Informática'), ('informatica', 'en', 'Computers'), ('informatica', 'es', 'Informática'),
  ('smartphones', 'pt-BR', 'Smartphones'), ('smartphones', 'pt-PT', 'Smartphones'), ('smartphones', 'en', 'Smartphones'), ('smartphones', 'es', 'Smartphones'),
  ('casa-e-decoracao', 'pt-BR', 'Casa e decoração'), ('casa-e-decoracao', 'pt-PT', 'Casa e decoração'), ('casa-e-decoracao', 'en', 'Home & decor'), ('casa-e-decoracao', 'es', 'Hogar y decoración'),
  ('eletrodomesticos', 'pt-BR', 'Eletrodomésticos'), ('eletrodomesticos', 'pt-PT', 'Eletrodomésticos'), ('eletrodomesticos', 'en', 'Appliances'), ('eletrodomesticos', 'es', 'Electrodomésticos'),
  ('moda', 'pt-BR', 'Moda'), ('moda', 'pt-PT', 'Moda'), ('moda', 'en', 'Fashion'), ('moda', 'es', 'Moda'),
  ('beleza', 'pt-BR', 'Beleza'), ('beleza', 'pt-PT', 'Beleza'), ('beleza', 'en', 'Beauty'), ('beleza', 'es', 'Belleza'),
  ('esportes', 'pt-BR', 'Esportes'), ('esportes', 'pt-PT', 'Desporto'), ('esportes', 'en', 'Sports'), ('esportes', 'es', 'Deportes'),
  ('games', 'pt-BR', 'Games'), ('games', 'pt-PT', 'Jogos'), ('games', 'en', 'Gaming'), ('games', 'es', 'Videojuegos'),
  ('acessorios', 'pt-BR', 'Acessórios'), ('acessorios', 'pt-PT', 'Acessórios'), ('acessorios', 'en', 'Accessories'), ('acessorios', 'es', 'Accesorios')
) as v(slug, locale, name)
join public.categories c on c.slug = v.slug
on conflict (category_id, locale) do nothing;

-- Affiliate networks (inactive until configured). Sub-ID parameter names per each network's
-- publisher link documentation: Awin `clickref`, Admitad `subid`, Impact `subId1`.
insert into public.affiliate_networks (key, adapter, name, subid_param, price_display_policy, active) values
  ('amazon', 'amazon', 'Amazon Afiliados', null, 'link_only', false),
  ('amazon-paapi', 'amazon_paapi', 'Amazon Product Advertising API', null, 'link_only', false),
  ('awin', 'awin', 'Awin', 'clickref', 'show', false),
  ('admitad', 'admitad', 'Admitad', 'subid', 'show', false),
  ('impact', 'impact', 'Impact', 'subId1', 'show', false)
on conflict (key) do nothing;

-- Default site settings ----------------------------------------------------------------------
insert into public.site_settings (key, value) values
  ('public.store_name', '"NEXTECH"'),
  ('public.contact_email', '""'),
  ('public.socials', '{}'),
  ('public.seo', '{"pt-BR": {"title": "NEXTECH — Descubra o que realmente vale a pena", "description": "Uma seleção de produtos, marcas e oportunidades em um só lugar."}, "pt-PT": {"title": "NEXTECH — Descubra o que realmente vale a pena", "description": "Uma seleção de produtos, marcas e oportunidades num só lugar."}, "en": {"title": "NEXTECH — Discover what''s truly worth it", "description": "A curated selection of products, brands and opportunities in one place."}, "es": {"title": "NEXTECH — Descubre lo que realmente vale la pena", "description": "Una selección de productos, marcas y oportunidades en un solo lugar."}}'),
  ('public.legal', '{"company_name": "", "tax_id": "", "address": ""}'),
  ('public.analytics', '{"ga4": "", "plausible": ""}'),
  ('public.cookie_texts', '{}'),
  ('public.institutional', '{}'),
  ('public.logo_path', 'null'),
  ('public.favicon_path', 'null'),
  ('public.hero_image', 'null'),
  ('ops.price_stale_days', '14')
on conflict (key) do nothing;
