const PATTERNS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  [/\b(bearer)\s+[\w.~+/=-]+/gi, "$1 [redacted]"],
  [/\b(token|secret|password|passwd|apikey|api_key|key|authorization)(\s*[=:]\s*)("?)[^\s"&,;]+/gi, "$1$2$3[redacted]"],
  [/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "[jwt]"],
];

export function redact(input: string): string {
  return PATTERNS.reduce((s, [re, rep]) => s.replace(re, rep), input);
}

function serialize(v: unknown): string {
  if (v instanceof Error) return v.message;
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Structured JSON logs (one line each) with emails/tokens redacted. */
export const log = {
  error(event: string, err: unknown, ctx?: Record<string, unknown>) {
    console.error(redact(JSON.stringify({ level: "error", event, message: serialize(err), ctx: ctx ? JSON.parse(redact(serialize(ctx)) || "{}") : undefined, at: new Date().toISOString() })));
  },
  info(event: string, ctx?: Record<string, unknown>) {
    console.log(redact(JSON.stringify({ level: "info", event, ctx, at: new Date().toISOString() })));
  },
};
