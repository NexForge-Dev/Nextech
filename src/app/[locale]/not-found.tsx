import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations();
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="text-sm font-medium tracking-widest text-mute">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">{t("errors.notFoundTitle")}</h1>
      <p className="text-mute">{t("errors.notFoundText")}</p>
      <Link href="/" className="mt-2 inline-flex h-10 items-center rounded-md bg-black px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-ink">
        {t("common.backHome")}
      </Link>
    </main>
  );
}
