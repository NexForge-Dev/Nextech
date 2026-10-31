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
  ('audit.read', 'Ver o log de auditoria')
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
  'conversions.import', 'customers.read', 'audit.read'
) where r.key = 'admin'
on conflict do nothing;

insert into public.admin_role_permissions (role_id, permission_id)
select r.id, p.id from public.admin_roles r join public.admin_permissions p on p.key in (
  'products.write', 'links.write', 'categories.write', 'brands.write', 'marketing.write'
) where r.key = 'editor'
on conflict do nothing;
