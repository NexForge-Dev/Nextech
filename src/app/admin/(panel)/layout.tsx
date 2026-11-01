import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { pageGuard } from "@/lib/admin/guard";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getAdminNotifications } from "@/lib/data/admin/notifications";
import { visibleNav } from "@/components/admin/nav";
import { Sidebar } from "@/components/admin/sidebar";
import { AdminHeader } from "@/components/admin/admin-header";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const ctx = await pageGuard();
  const [jar, notes] = await Promise.all([cookies(), getAdminNotifications(ctx)]);
  const nav = visibleNav(ctx.permissions);
  return (
    <div className="flex min-h-screen">
      <Sidebar items={nav} initialCollapsed={jar.get("nx_admin_sidebar")?.value === "1"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader nav={nav} email={ctx.email} roleLabel={ROLE_LABELS[ctx.role]} notifications={notes.items} unread={notes.unread} />
        <main className="flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}
