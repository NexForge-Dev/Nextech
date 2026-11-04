import { getTranslations } from "next-intl/server";
import { Banknote, CreditCard, QrCode } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { StoreContext } from "@/lib/data/context";
import { Logo } from "./logo";
import { MarketSelector } from "./market-selector";
import { CookiePreferencesButton } from "./cookie-banner";
import { sellerContactLine } from "@/lib/domain/seller";

export async function Footer({ ctx, storeName, legal = { company_name: "", tax_id: "", address: "" }, contactEmail = "" }: { ctx: StoreContext; storeName: string; legal?: { company_name: string; tax_id: string; address: string }; contactEmail?: string }) {
  const [t, tm, ts] = await Promise.all([getTranslations("footer"), getTranslations("markets"), getTranslations("store")]);
  const marketName = (code: string) => (tm.has(code as "BR") ? tm(code as "BR") : code);
  const options = ctx.availableMarkets.map((code) => ({ code, name: marketName(code) }));
  // Decreto 7.962/2013: seller identity on every page; only the fields the admin filled in, plus the contact
  const seller = sellerContactLine(legal, contactEmail);
  const { card, boleto, pix } = ctx.businessModels.payments;
  const methods = ctx.businessModels.ownStore
    ? [
        ...(card ? [{ icon: CreditCard, label: ts("methodCard") }] : []),
        ...(boleto ? [{ icon: Banknote, label: ts("methodBoleto") }] : []),
        ...(pix ? [{ icon: QrCode, label: ts("methodPix") }] : []),
      ]
    : [];
  const link = "text-sm text-white/70 transition-colors duration-150 hover:text-white";
  const heading = "text-xs font-semibold uppercase tracking-[0.08em] text-white";
  return (
    <footer className="mt-auto bg-black text-white">
      <div className="shell grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-4 md:py-16">
        <div className="col-span-2 space-y-4 md:col-span-1">
          <Logo name={storeName} className="text-white" />
          <p className="max-w-xs text-sm text-white/70">{ctx.businessModels.affiliates ? t("affiliateNotice") : t("ownStoreNotice")}</p>
        </div>
        <nav className="space-y-3" aria-label={t("company")}>
          <p className={heading}>{t("company")}</p>
          <ul className="space-y-2">
            <li><Link className={link} href="/sobre">{t("about")}</Link></li>
            <li><Link className={link} href="/como-funciona">{t("howItWorks")}</Link></li>
            {ctx.businessModels.affiliates && <li><Link className={link} href="/como-ganhamos-dinheiro">{t("howWeEarn")}</Link></li>}
          </ul>
        </nav>
        <nav className="space-y-3" aria-label={t("help")}>
          <p className={heading}>{t("help")}</p>
          <ul className="space-y-2">
            <li><Link className={link} href="/faq">{t("faq")}</Link></li>
            <li><Link className={link} href="/contato">{t("contact")}</Link></li>
            {ctx.businessModels.affiliates && <li><Link className={link} href="/afiliados">{t("affiliateDisclosure")}</Link></li>}
          </ul>
        </nav>
        <nav className="col-span-2 space-y-3 md:col-span-1" aria-label={t("legal")}>
          <p className={heading}>{t("legal")}</p>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-1">
            <li><Link className={link} href="/privacidade">{t("privacy")}</Link></li>
            <li><Link className={link} href="/termos">{t("terms")}</Link></li>
            {ctx.businessModels.ownStore && <li><Link className={link} href="/trocas-e-devolucoes">{t("returns")}</Link></li>}
            {ctx.businessModels.ownStore && <li><Link className={link} href="/entrega">{t("shipping")}</Link></li>}
            <li><Link className={link} href="/cookies">{t("cookies")}</Link></li>
            <li><CookiePreferencesButton label={t("cookiePreferences")} className={`${link} cursor-pointer text-left`} /></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/15">
        <div className="shell flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs text-white/60">{t("rights", { year: new Date().getFullYear() })}</p>
            {ctx.businessModels.ownStore && (
              <p className="text-xs text-white/60" data-testid="seller-identity">
                {seller}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {methods.length > 0 && (
              <ul aria-label={ts("paymentMethods")} className="flex flex-wrap items-center gap-2">
                {methods.map(({ icon: Icon, label }) => (
                  <li key={label} className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-white/25 px-2 text-xs font-medium">
                    <Icon className="size-3.5" strokeWidth={1.75} aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
            )}
            {options.length > 1 && !ctx.brazilOnly ? (
              <MarketSelector current={ctx.market} options={options} label={t("country")} />
            ) : (
              <p className="text-sm text-white/60">
                {t("country")}: {marketName(ctx.market)}
              </p>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
