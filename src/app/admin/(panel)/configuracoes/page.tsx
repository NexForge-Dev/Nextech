import Link from "next/link";
import { ScrollText } from "lucide-react";
import { pageGuard } from "@/lib/admin/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsForm, type SettingsValue } from "@/components/admin/people-forms";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const ctx = await pageGuard();
  if (!ctx.permissions.has("settings.write")) {
    if (ctx.permissions.has("audit.read")) {
      return (
        <>
          <PageHeader title="Configurações" />
          <Link href="/admin/configuracoes/logs" className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-4 text-sm font-medium hover:bg-soft"><ScrollText className="size-4" /> Log de auditoria</Link>
        </>
      );
    }
    await pageGuard("settings.write");
  }
  const sb = await createServerSupabase();
  const { data } = await sb.from("site_settings").select("key, value");
  const m = new Map((data ?? []).map((r) => [r.key, r.value as unknown]));
  const obj = <T,>(k: string, d: T): T => {
    const v = m.get(k);
    return v && typeof v === "object" && !Array.isArray(v) ? ({ ...d, ...(v as object) } as T) : d;
  };
  const str = (k: string) => (typeof m.get(k) === "string" ? (m.get(k) as string) : "");
  const initial: SettingsValue = {
    storeName: str("public.store_name") || "NEXTECH",
    contactEmail: str("public.contact_email"),
    logoPath: str("public.logo_path") || null,
    faviconPath: str("public.favicon_path") || null,
    heroImage: str("public.hero_image") || null,
    institutional: obj("public.institutional", {}),
    socials: obj("public.socials", {}),
    seo: obj("public.seo", {}),
    analytics: obj("public.analytics", { ga4: "", plausible: "" }),
    cookieTexts: obj("public.cookie_texts", {}),
    legal: obj("public.legal", { company_name: "", tax_id: "", address: "" }),
    priceStaleDays: Number(m.get("ops.price_stale_days") ?? 14) || 14,
  };
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Dados gerais da loja. As alterações aparecem na loja em alguns segundos."
        actions={ctx.permissions.has("audit.read") && <Link href="/admin/configuracoes/logs" className="inline-flex h-10 items-center gap-2 rounded-md border border-line px-4 text-sm font-medium hover:bg-soft"><ScrollText className="size-4" /> Log de auditoria</Link>}
      />
      <SettingsForm initial={initial} />
    </>
  );
}
