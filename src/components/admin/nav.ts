import type { Permission } from "@/lib/auth/permissions";

export type NavItem = { href: string; label: string; icon: string; permission?: Permission; any?: Permission[] };

/** Sidebar entries; an item is shown when the admin has `permission` (or any of `any`). */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Visão geral", icon: "LayoutDashboard" },
  { href: "/admin/produtos", label: "Produtos", icon: "Package", permission: "products.write" },
  { href: "/admin/marcas", label: "Marcas", icon: "BadgeCheck", permission: "brands.write" },
  { href: "/admin/categorias", label: "Categorias", icon: "Shapes", permission: "categories.write" },
  { href: "/admin/lojas", label: "Lojas parceiras", icon: "Store", permission: "stores.write" },
  { href: "/admin/links", label: "Links de afiliados", icon: "Link2", permission: "links.write" },
  { href: "/admin/afiliados", label: "Redes de afiliados", icon: "Network", any: ["networks.read", "networks.write"] },
  { href: "/admin/ofertas", label: "Ofertas", icon: "Tag", permission: "marketing.write" },
  { href: "/admin/banners", label: "Banners", icon: "GalleryHorizontal", permission: "marketing.write" },
  { href: "/admin/campanhas", label: "Campanhas", icon: "Megaphone", permission: "marketing.write" },
  { href: "/admin/clientes", label: "Clientes", icon: "Users", permission: "customers.read" },
  { href: "/admin/analytics", label: "Analytics", icon: "ChartLine", permission: "analytics.read" },
  { href: "/admin/relatorios", label: "Relatórios", icon: "FileSpreadsheet", permission: "analytics.read" },
  { href: "/admin/administradores", label: "Administradores", icon: "ShieldCheck", permission: "admins.write" },
  { href: "/admin/configuracoes", label: "Configurações", icon: "Settings", any: ["settings.write", "audit.read"] },
];

export function visibleNav(perms: Set<string>): NavItem[] {
  return ADMIN_NAV.filter((i) => (!i.permission && !i.any) || (i.permission && perms.has(i.permission)) || (i.any && i.any.some((p) => perms.has(p))));
}
