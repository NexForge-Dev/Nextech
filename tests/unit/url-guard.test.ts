import { describe, it, expect } from "vitest";
import { normalizeHost, hostAllowed, validateExternalUrl, appendParam } from "@/lib/domain/url-guard";

describe("url guard", () => {
  it("normalizes hosts", () => expect(normalizeHost("WWW.Amazon.com.br.")).toBe("amazon.com.br"));
  it("rejects http", () => expect(validateExternalUrl("http://amazon.com.br/x")).toEqual({ ok: false, reason: "not_https" }));
  it("rejects look-alike hosts", () => {
    expect(validateExternalUrl("https://amazon.com.br.evil.com/x", ["amazon.com.br"])).toEqual({ ok: false, reason: "host_not_allowed", host: "amazon.com.br.evil.com" });
  });
  it("accepts www subdomain of an allowed domain", () => expect(validateExternalUrl("https://www.amazon.com.br/dp/1", ["amazon.com.br"]).ok).toBe(true));
  it("accepts short-link domains when allowed", () => expect(validateExternalUrl("https://amzn.to/abc", ["amazon.com.br", "amzn.to"]).ok).toBe(true));
  it("rejects javascript: URLs", () => expect(validateExternalUrl("javascript:alert(1)")).toEqual({ ok: false, reason: "invalid" }));
  it("rejects credentials in URLs", () => expect(validateExternalUrl("https://user:pass@amazon.com.br")).toEqual({ ok: false, reason: "invalid" }));
  it("rejects garbage", () => expect(validateExternalUrl("not a url")).toEqual({ ok: false, reason: "invalid" }));
  it("accepts any https host when no allow-list is given", () => expect(validateExternalUrl("https://loja.com/p").ok).toBe(true));
  it("hostAllowed requires a dot boundary", () => expect(hostAllowed("https://notamazon.com.br/", ["amazon.com.br"])).toBe(false));
  it("appends and encodes a parameter", () => {
    expect(appendParam("https://a.com/x?y=1", "sub", "c1")).toBe("https://a.com/x?y=1&sub=c1");
    expect(appendParam("https://a.com/x", "sub", "a b&c")).toBe("https://a.com/x?sub=a+b%26c");
  });
});
