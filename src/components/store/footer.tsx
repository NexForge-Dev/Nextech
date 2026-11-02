import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { StoreContext } from "@/lib/data/context";
import { Logo } from "./logo";
import { MarketSelector } from "./market-selector";
import { CookiePreferencesButton } from "./cookie-banner";

export async function Footer({ ctx, storeName, legal = { company_name: "", tax_id: "", address: "" }, contactEmail = "" }: { ctx: StoreContext; storeName: string; legal?: { company_name: string; tax_id: string; address: string }; contactEmail?: string }) {
  const t = await getTranslations("footer");
  const tm = await getTranslations("markets");
  const marketName = (code: string) => (tm.has(code as "BR") ? tm(code as "BR") : code);
  const options = ctx.availableMarkets.map((code) => ({ code, name: marketName(code) }));
  const link = "text-sm text-mute transition-colors duration-150 hover:text-black";
  return (
    <footer className="mt-auto border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-4 py-14 md:grid-cols-4 md:px-6">
        <div className="col-span-2 space-y-4 md:col-span-1">
          <Logo name={storeName} />
          <p className="max-w-xs text-sm text-mute">{ctx.businessModels.affiliates ? t("affiliateNotice") : t("ownStoreNotice")}</p>
        </div>
        <nav className="space-y-3" aria-label={t("company")}>
          <p className="text-xs font-medium uppercase tracking-wider text-black">{t("company")}</p>
          <ul className="space-y-2">
            <li><Link className={link} href="/sobre">{t("about")}</Link></li>
            <li><Link className={link} href="/como-funciona">{t("howItWorks")}</Link></li>
            {ctx.businessModels.affiliates && <li><Link className={link} href="/como-ganhamos-dinheiro">{t("howWeEarn")}</Link></li>}
          </ul>
        </nav>
        <nav className="space-y-3" aria-label={t("help")}>
          <p className="text-xs font-medium uppercase tracking-wider text-black">{t("help")}</p>
          <ul className="space-y-2">
            <li><Link className={link} href="/faq">{t("faq")}</Link></li>
            <li><Link className={link} href="/contato">{t("contact")}</Link></li>
            {ctx.businessModels.affiliates && <li><Link className={link} href="/afiliados">{t("affiliateDisclosure")}</Link></li>}
          </ul>
        </nav>
        <nav className="space-y-3" aria-label={t("legal")}>
          <p className="text-xs font-medium uppercase tracking-wider text-black">{t("legal")}</p>
          <ul className="space-y-2">
            <li><Link className={link} href="/privacidade">{t("privacy")}</Link></li>
            <li><Link className={link} href="/termos">{t("terms")}</Link></li>
            {ctx.businessModels.ownStore && <li><Link className={link} href="/trocas-e-devolucoes">{t("returns")}</Link></li>}
            {ctx.businessModels.ownStore && <li><Link className={link} href="/entrega">{t("shipping")}</Link></li>}
            <li><Link className={link} href="/cookies">{t("cookies")}</Link></li>
            <li><CookiePreferencesButton label={t("cookiePreferences")} className={`${link} cursor-pointer text-left`} /></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="space-y-1">
            <p className="text-xs text-mute">{t("rights", { year: new Date().getFullYear() })}</p>
            {ctx.businessModels.ownStore && legal.company_name && (
              <p className="text-xs text-mute" data-testid="seller-identity">
                {[legal.company_name, legal.tax_id && `CNPJ ${legal.tax_id}`, legal.address, contactEmail].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {options.length > 1 && !ctx.brazilOnly ? (
            <MarketSelector current={ctx.market} options={options} label={t("country")} />
          ) : (
            <p className="text-sm text-mute">
              {t("country")}: {marketName(ctx.market)}
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
