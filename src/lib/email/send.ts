import { log } from "@/lib/log";

export type EmailMessage = { to: string; subject: string; html: string; text: string };

/**
 * Transactional email through the Resend HTTP API. Never throws: when RESEND_API_KEY/EMAIL_FROM are
 * missing or the provider fails, the email is logged as skipped and `{ sent: false }` is returned.
 */
export async function sendEmail(m: EmailMessage, fetchImpl: typeof fetch = fetch): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from || !m.to) {
    log.info("email.skipped", { reason: !m.to ? "no_recipient" : "not_configured", subject: m.subject });
    return { sent: false };
  }
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      log.error("email.failed", new Error(`resend ${res.status}`), { subject: m.subject });
      return { sent: false };
    }
    return { sent: true };
  } catch (e) {
    log.error("email.failed", e, { subject: m.subject });
    return { sent: false };
  }
}
