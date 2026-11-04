import { getTranslations } from "next-intl/server";
import { ArrowRight, CreditCard, PackageCheck, RotateCcw, Search, ShieldCheck, Lock, Truck } from "lucide-react";
import { Link } from "@/i18n/navigation";

/** Store promises, each linked to the page that states it in full. Own store only: affiliates sell elsewhere. */
export async function TrustBar() {
  const t = await getTranslations("store");
  const items = [
    { icon: Truck, title: t("freeShipping"), note: t("freeShippingNote"), href: "/entrega" },
    { icon: Lock, title: t("securePayment"), note: t("securePaymentNote"), href: "/como-funciona" },
    { icon: RotateCcw, title: t("withdrawal"), note: t("withdrawalNote"), href: "/trocas-e-devolucoes" },
    { icon: ShieldCheck, title: t("warranty"), note: t("warrantyNote"), href: "/trocas-e-devolucoes" },
  ] as const;
  return (
    <section aria-label={t("securePayment")} className="border-b border-line bg-white">
      <ul className="shell grid grid-cols-2 gap-x-4 gap-y-5 py-6 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, note, href }) => (
          <li key={title}>
            <Link href={href} className="group flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-soft transition-colors duration-150 group-hover:bg-black group-hover:text-white">
                <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">{title}</span>
                <span className="mt-0.5 block text-xs text-mute">{note}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The purchase journey, condensed from the "Como funciona" page. */
export async function HowToBuy({ storeName }: { storeName: string }) {
  const [t, tf] = await Promise.all([getTranslations("store"), getTranslations("footer")]);
  const steps = [
    { icon: Search, title: t("step1Title"), text: t("step1Text") },
    { icon: CreditCard, title: t("step2Title"), text: t("step2Text") },
    { icon: Truck, title: t("step3Title"), text: t("step3Text") },
    { icon: PackageCheck, title: t("step4Title"), text: t("step4Text") },
  ];
  return (
    <section aria-labelledby="how-to-buy" className="border-t border-line">
      <div className="shell py-10 md:py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 id="how-to-buy" className="t-section">{t("howTitle", { store: storeName })}</h2>
            <p className="mt-1 text-sm text-mute">{t("howSubtitle")}</p>
          </div>
          <Link href="/como-funciona" className="hidden shrink-0 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline sm:inline-flex">
            {t("howMore")}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="panel p-5">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-full bg-black text-white">
                  <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="tabular text-sm font-semibold text-mute" aria-hidden>{i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
              <p className="mt-1 text-sm text-mute">{text}</p>
            </li>
          ))}
        </ol>
        <Link href="/como-funciona" className="mt-4 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline sm:hidden" aria-label={tf("howItWorks")}>
          {t("howMore")}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
