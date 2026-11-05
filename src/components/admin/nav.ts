import type { Permission } from "@/lib/auth/permissions";

export type NavItem = { href: string; label: string; icon: string; group: NavGroup; permission?: Permission; any?: Permission[] };
export type NavGroup = "main" | "catalog" | "affiliates" | "marketing" | "insights" | "system";

export const NAV_GROUP_LABEL: Record<NavGroup, string | null> = { main: null, catalog: "Catálogo", affiliates: "Afiliados", marketing: "Marketing", insights: "Clientes e dados", system: "Sistema" };

/** Sidebar entries; an item is shown when the admin has `permission` (or any of `any`). */
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Visão geral", icon: "LayoutDashboard", group: "main" },
  { href: "/admin/pedidos", label: "Pedidos", icon: "ShoppingCart", group: "main", permission: "orders.read" },
  { href: "/admin/produtos", label: "Produtos", icon: "Package", group: "catalog", permission: "products.write" },
  { href: "/admin/marcas", label: "Marcas", icon: "BadgeCheck", group: "catalog", permission: "brands.write" },
  { href: "/admin/categorias", label: "Categorias", icon: "Shapes", group: "catalog", permission: "categories.write" },
  { href: "/admin/lojas", label: "Lojas parceiras", icon: "Store", group: "affiliates", permission: "stores.write" },
  { href: "/admin/links", label: "Links de afiliados", icon: "Link2", group: "affiliates", permission: "links.write" },
  { href: "/admin/afiliados", label: "Redes de afiliados", icon: "Network", group: "affiliates", any: ["networks.read", "networks.write"] },
  { href: "/admin/ofertas", label: "Ofertas", icon: "Tag", group: "marketing", permission: "marketing.write" },
  { href: "/admin/banners", label: "Banners", icon: "GalleryHorizontal", group: "marketing", permission: "marketing.write" },
  { href: "/admin/campanhas", label: "Campanhas", icon: "Megaphone", group: "marketing", permission: "marketing.write" },
  { href: "/admin/clientes", label: "Clientes", icon: "Users", group: "insights", permission: "customers.read" },
  { href: "/admin/bi", label: "BI de vendas", icon: "ChartPie", group: "insights", permission: "orders.read" },
  { href: "/admin/analytics", label: "Analytics", icon: "ChartLine", group: "insights", permission: "analytics.read" },
  { href: "/admin/relatorios", label: "Relatórios", icon: "FileSpreadsheet", group: "insights", permission: "analytics.read" },
  { href: "/admin/administradores", label: "Administradores", icon: "ShieldCheck", group: "system", permission: "admins.write" },
  { href: "/admin/configuracoes", label: "Configurações", icon: "Settings", group: "system", any: ["settings.write", "audit.read"] },
];

export function visibleNav(perms: Set<string>): NavItem[] {
  return ADMIN_NAV.filter((i) => (!i.permission && !i.any) || (i.permission && perms.has(i.permission)) || (i.any && i.any.some((p) => perms.has(p))));
}
