import { describe, it, expect, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptCredentials, decryptCredentials, MissingKeyError } from "@/lib/security/credentials-crypto";

beforeEach(() => {
  process.env.NETWORK_CREDENTIALS_KEY = randomBytes(32).toString("base64");
});

describe("credential encryption", () => {
  it("roundtrips", () => {
    const row = encryptCredentials({ token: "abcd1234", secret: "s3cr3t" });
    expect(decryptCredentials(row)).toEqual({ token: "abcd1234", secret: "s3cr3t" });
    expect(row.ciphertext).not.toContain("abcd1234");
  });
  it("detects tampering", () => {
    const row = encryptCredentials({ token: "abcd1234" });
    const tag = Buffer.from(row.tag, "base64");
    tag[0] ^= 0xff;
    expect(() => decryptCredentials({ ...row, tag: tag.toString("base64") })).toThrow();
  });
  it("derives last4 from the longest secret value", () => {
    expect(encryptCredentials({ token: "abcd1234" }).last4).toBe("1234");
  });
  it("throws MissingKeyError without a key", () => {
    delete process.env.NETWORK_CREDENTIALS_KEY;
    expect(() => encryptCredentials({ a: "b" })).toThrow(MissingKeyError);
  });
  it("throws MissingKeyError for a wrong-length key", () => {
    process.env.NETWORK_CREDENTIALS_KEY = Buffer.from("short").toString("base64");
    expect(() => encryptCredentials({ a: "b" })).toThrow(MissingKeyError);
  });
});
