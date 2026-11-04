import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Heart, MapPin, Package } from "lucide-react";
import { getPublicSettings } from "@/lib/data/settings";

export async function AuthShell({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  const [t, settings] = await Promise.all([getTranslations("store"), getPublicSettings()]);
  const points = [
    { icon: Package, text: t("authTrackOrders") },
    { icon: Heart, text: t("authFavorites") },
    { icon: MapPin, text: t("authCheckout") },
  ];
  return (
    <main className="flex flex-1 items-start bg-soft px-4 py-8 md:items-center md:py-14">
      <div className="panel mx-auto grid w-full max-w-md overflow-hidden lg:max-w-4xl lg:grid-cols-2">
        <div className="hidden flex-col justify-center bg-black p-10 text-white lg:flex">
          <p className="text-2xl font-semibold leading-tight tracking-[-0.02em]">{t("authPitch", { store: settings.storeName })}</p>
          <ul className="mt-8 space-y-5">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-white/80">
                <Icon className="mt-0.5 size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-6 md:p-10">
          <h1 className="t-page">{title}</h1>
          <div className="mt-6">{children}</div>
          {aside && <div className="mt-6 border-t border-line pt-5 text-sm text-mute">{aside}</div>}
        </div>
      </div>
    </main>
  );
}
