import { describe, it, expect } from "vitest";
import { contactSchema, classifyContact } from "@/lib/domain/contact";

const valid = { name: "Ana", email: "ana@example.com", subject: "Dúvida", body: "Olá, tenho uma dúvida sobre a loja.", website: "" };

describe("contact", () => {
  it("accepts a valid message", () => expect(contactSchema.safeParse(valid).success).toBe(true));
  it("rejects a short body", () => expect(contactSchema.safeParse({ ...valid, body: "curto" }).success).toBe(false));
  it("rejects an invalid email", () => expect(contactSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false));
  it("silently drops honeypot submissions", () => expect(classifyContact({ ...valid, website: "http://spam" })).toEqual({ ok: true, store: false }));
  it("stores normal submissions", () => expect(classifyContact(valid)).toEqual({ ok: true, store: true }));
  it("rejects invalid submissions", () => expect(classifyContact({ ...valid, email: "x" })).toEqual({ ok: false, store: false }));
});
