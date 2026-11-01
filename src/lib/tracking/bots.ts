const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|embedly|quora link preview|whatsapp|telegram|preview|headless|lighthouse|pagespeed|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|python-requests|curl\/|wget|httpclient|okhttp|go-http-client|axios\//i;

export function isBot(ua: string | null | undefined): boolean {
  if (!ua || ua.trim().length < 10) return true;
  return BOT_RE.test(ua);
}
