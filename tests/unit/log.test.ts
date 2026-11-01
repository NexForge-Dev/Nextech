import { describe, it, expect, vi } from "vitest";
import { log, redact } from "@/lib/log";

describe("log", () => {
  it("redacts emails and tokens", () => {
    const out = redact("falha para a@b.com token=abc123 Bearer xyz.789 password: s3cr3t");
    expect(out).not.toContain("a@b.com");
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("xyz.789");
    expect(out).not.toContain("s3cr3t");
  });
  it("writes one JSON line without the secrets", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    log.error("x", new Error("a@b.com token=abc"), { email: "c@d.com" });
    const line = String(spy.mock.calls[0][0]);
    spy.mockRestore();
    expect(() => JSON.parse(line)).not.toThrow();
    expect(line).not.toContain("a@b.com");
    expect(line).not.toContain("abc");
    expect(line).not.toContain("c@d.com");
  });
});
