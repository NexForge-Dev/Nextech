import { describe, it, expect } from "vitest";
import { isBot } from "@/lib/tracking/bots";

describe("isBot", () => {
  it("flags Googlebot", () => expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true));
  it("flags empty UA", () => expect(isBot("")).toBe(true));
  it("flags null UA", () => expect(isBot(null)).toBe(true));
  it("flags facebookexternalhit", () => expect(isBot("facebookexternalhit/1.1")).toBe(true));
  it("flags headless Chrome", () => expect(isBot("Mozilla/5.0 HeadlessChrome/120.0")).toBe(true));
  it("accepts desktop Chrome", () => expect(isBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")).toBe(false));
});
