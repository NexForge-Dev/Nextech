import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations();
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="tabular text-6xl font-semibold tracking-tight">404</p>
      <h1 className="t-page">{t("errors.notFoundTitle")}</h1>
      <p className="text-mute">{t("errors.notFoundText")}</p>
      <Link href="/" className="btn btn-primary mt-2">
        {t("common.backHome")}
      </Link>
    </main>
  );
}
