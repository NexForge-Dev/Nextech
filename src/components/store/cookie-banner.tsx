"use client";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Link } from "@/i18n/navigation";
import { saveConsent } from "@/actions/store/preferences";

export const OPEN_COOKIE_PREFERENCES = "nx-open-cookie-preferences";

export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES));
}

export function CookiePreferencesButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={openCookiePreferences} className={className ?? "cursor-pointer text-left hover:text-black"}>
      {label}
    </button>
  );
}

export function CookieBanner({ decided, initial, texts }: { decided: boolean; initial: { analytics: boolean }; texts?: { title?: string; text?: string } }) {
  const t = useTranslations("cookies");
  const router = useRouter();
  const [visible, setVisible] = useState(!decided);
  const [dialog, setDialog] = useState(false);
  const [analytics, setAnalytics] = useState(initial.analytics);
  const [pending, start] = useTransition();

  useEffect(() => {
    const open = () => setDialog(true);
    window.addEventListener(OPEN_COOKIE_PREFERENCES, open);
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES, open);
  }, []);

  function save(a: boolean) {
    start(async () => {
      await saveConsent({ analytics: a, marketing: false });
      setVisible(false);
      setDialog(false);
      router.refresh();
    });
  }

  const btn = "h-10 cursor-pointer rounded-md px-4 text-sm font-medium transition-colors duration-150 disabled:opacity-50";
  return (
    <>
      {visible && (
        <div role="region" aria-label={t("bannerTitle")} className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white px-4 py-4 md:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-3xl text-sm">
              <p className="font-medium text-black">{texts?.title || t("bannerTitle")}</p>
              <p className="mt-1 text-mute">
                {texts?.text || t("bannerText")}{" "}
                <Link href="/cookies" className="text-black underline underline-offset-2">
                  {t("policy")}
                </Link>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => setDialog(true)} className={`${btn} border border-line bg-white text-black hover:bg-soft`}>
                {t("customize")}
              </button>
              <button type="button" disabled={pending} onClick={() => save(false)} className={`${btn} border border-black bg-white text-black hover:bg-soft`}>
                {t("rejectOptional")}
              </button>
              <button type="button" disabled={pending} onClick={() => save(true)} className={`${btn} bg-black text-white hover:bg-ink`}>
                {t("acceptAll")}
              </button>
            </div>
          </div>
        </div>
      )}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg rounded-md border border-line p-6 shadow-none ring-0">
          <DialogTitle className="text-lg font-semibold">{t("bannerTitle")}</DialogTitle>
          <DialogDescription className="text-sm text-mute">{t("bannerText")}</DialogDescription>
          <div className="mt-2 divide-y divide-line border-y border-line">
            <Row title={t("essential")} text={t("essentialText")}>
              <span className="text-xs font-medium text-mute">{t("alwaysOn")}</span>
            </Row>
            <Row title={t("analytics")} text={t("analyticsText")}>
              <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label={t("analytics")} />
            </Row>
            <Row title={t("marketing")} text={t("marketingText")}>
              <Switch checked={false} disabled aria-label={t("marketing")} />
            </Row>
          </div>
          <div className="mt-2 flex justify-end">
            <button type="button" disabled={pending} onClick={() => save(analytics)} className={`${btn} bg-black text-white hover:bg-ink`}>
              {t("save")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-mute">{text}</p>
      </div>
      <div className="pt-0.5">{children}</div>
    </div>
  );
}
