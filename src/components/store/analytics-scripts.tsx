import Script from "next/script";

/** Third-party analytics load only after the visitor accepted analytics cookies. */
export function AnalyticsScripts({ consented, ga4, plausible }: { consented: boolean; ga4: string; plausible: string }) {
  if (!consented) return null;
  const gaId = /^G-[A-Z0-9]+$/.test(ga4) ? ga4 : null;
  const plausibleDomain = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(plausible) ? plausible : null;
  return (
    <>
      {gaId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {plausibleDomain && <Script src="https://plausible.io/js/script.js" data-domain={plausibleDomain} strategy="afterInteractive" />}
    </>
  );
}
