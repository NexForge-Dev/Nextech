import { defineRouting } from "next-intl/routing";

export const LOCALES = ["pt-BR", "pt-PT", "en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt-BR";

export const LOCALE_PREFIX: Record<Locale, string> = {
  "pt-BR": "/pt-br",
  "pt-PT": "/pt-pt",
  en: "/en",
  es: "/es",
};

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

type Localized = { "pt-BR": string; "pt-PT": string; en: string; es: string };
const pt = (p: string, en: string, es: string): Localized => ({ "pt-BR": p, "pt-PT": p, en, es });

export const pathnames = {
  "/": "/",
  "/produtos": pt("/produtos", "/products", "/productos"),
  "/produto/[slug]": pt("/produto/[slug]", "/product/[slug]", "/producto/[slug]"),
  "/categoria/[slug]": pt("/categoria/[slug]", "/category/[slug]", "/categoria/[slug]"),
  "/ofertas": pt("/ofertas", "/deals", "/ofertas"),
  "/favoritos": pt("/favoritos", "/favorites", "/favoritos"),
  "/minha-conta": pt("/minha-conta", "/my-account", "/mi-cuenta"),
  "/minha-conta/favoritos": pt("/minha-conta/favoritos", "/my-account/favorites", "/mi-cuenta/favoritos"),
  "/minha-conta/historico": pt("/minha-conta/historico", "/my-account/history", "/mi-cuenta/historial"),
  "/minha-conta/preferencias": pt("/minha-conta/preferencias", "/my-account/preferences", "/mi-cuenta/preferencias"),
  "/minha-conta/privacidade": pt("/minha-conta/privacidade", "/my-account/privacy", "/mi-cuenta/privacidad"),
  "/sobre": pt("/sobre", "/about", "/sobre-nosotros"),
  "/como-funciona": pt("/como-funciona", "/how-it-works", "/como-funciona"),
  "/como-ganhamos-dinheiro": pt("/como-ganhamos-dinheiro", "/how-we-earn", "/como-ganamos-dinero"),
  "/faq": "/faq",
  "/contato": pt("/contato", "/contact", "/contacto"),
  "/privacidade": pt("/privacidade", "/privacy", "/privacidad"),
  "/termos": pt("/termos", "/terms", "/terminos"),
  "/cookies": "/cookies",
  "/afiliados": pt("/afiliados", "/affiliate-disclosure", "/afiliados"),
  "/campanha/[slug]": pt("/campanha/[slug]", "/campaign/[slug]", "/campana/[slug]"),
  "/entrar": pt("/entrar", "/sign-in", "/iniciar-sesion"),
  "/cadastro": pt("/cadastro", "/sign-up", "/registro"),
  "/recuperar-senha": pt("/recuperar-senha", "/forgot-password", "/recuperar-contrasena"),
  "/redefinir-senha": pt("/redefinir-senha", "/reset-password", "/restablecer-contrasena"),
} as const;

export type InternalPathname = keyof typeof pathnames;

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: { mode: "always", prefixes: LOCALE_PREFIX },
  localeDetection: true,
  pathnames,
});

/**
 * Next.js passes the URL segment to `[locale]` unchanged in some cases (e.g. "pt-br"),
 * because the prefix rewrite only differs in letter case. Resolve it back to the locale.
 */
export function resolveLocaleParam(param: string): Locale | null {
  if (isLocale(param)) return param;
  const lower = param.toLowerCase();
  const found = LOCALES.find((l) => l.toLowerCase() === lower || LOCALE_PREFIX[l] === `/${lower}`);
  return found ?? null;
}
