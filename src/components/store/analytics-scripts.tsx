import Script from "next/script";
import { GOOGLE_ADS_ID, GOOGLE_ADS_LABEL, META_PIXEL_ID } from "@/lib/admin/schemas/settings";
import { GOOGLE_CONSENT_DENIED, googleConsentState } from "@/lib/domain/consent";
import { MarketingTracker } from "./marketing-tracker";
import { ConsentModeSync } from "./consent-mode-sync";

type Props = {
  /** Visitor accepted analytics cookies (GA4, Plausible). */
  consented: boolean;
  /** Visitor accepted marketing cookies (Google Ads, Meta Pixel). */
  marketing: boolean;
  ga4: string;
  plausible: string;
  googleAds?: string;
  googleAdsConversion?: string;
  metaPixel?: string;
};

/**
 * Third-party tags load only after the visitor accepted the matching cookie category. Google tags also
 * receive Consent Mode v2 signals: everything denied by default, then updated from the banner choices.
 */
export function AnalyticsScripts({ consented, marketing, ga4, plausible, googleAds = "", googleAdsConversion = "", metaPixel = "" }: Props) {
  const gaId = consented && /^G-[A-Z0-9]+$/.test(ga4) ? ga4 : null;
  const plausibleDomain = consented && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(plausible) ? plausible : null;
  const awId = marketing && GOOGLE_ADS_ID.test(googleAds) ? googleAds : null;
  const awSendTo = awId && GOOGLE_ADS_LABEL.test(googleAdsConversion) ? `${awId}/${googleAdsConversion}` : null;
  const pixelId = marketing && META_PIXEL_ID.test(metaPixel) ? metaPixel : null;
  const gtagId = gaId ?? awId;
  const googleConfigured = /^G-[A-Z0-9]+$/.test(ga4) || GOOGLE_ADS_ID.test(googleAds);
  const consentDefault = JSON.stringify({ ...GOOGLE_CONSENT_DENIED, wait_for_update: 500 });
  const consentUpdate = JSON.stringify(googleConsentState({ analytics: consented, marketing }));

  const gtagConfig = [
    gaId ? `gtag('config','${gaId}',{anonymize_ip:true});` : "",
    awId ? `gtag('config','${awId}');` : "",
  ].join("");

  return (
    <>
      {gtagId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',${consentDefault});gtag('consent','update',${consentUpdate});gtag('set','ads_data_redaction',${marketing ? "false" : "true"});gtag('js',new Date());${gtagConfig}`}
          </Script>
        </>
      )}
      {plausibleDomain && <Script src="https://plausible.io/js/script.js" data-domain={plausibleDomain} strategy="afterInteractive" />}
      {pixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`}
        </Script>
      )}
      {googleConfigured && <ConsentModeSync analytics={consented} marketing={marketing} />}
      {(awId || pixelId) && <MarketingTracker pixel={!!pixelId} googleAdsSendTo={awSendTo} />}
    </>
  );
}
