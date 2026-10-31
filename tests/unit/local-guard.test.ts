import { describe, it, expect } from "vitest";
import { assertLocalSupabase } from "../../scripts/lib/local-guard";

describe("assertLocalSupabase", () => {
  it("throws for a cloud URL", () => expect(() => assertLocalSupabase("https://abc.supabase.co")).toThrow());
  it("accepts 127.0.0.1", () => expect(() => assertLocalSupabase("http://127.0.0.1:55821")).not.toThrow());
  it("accepts localhost", () => expect(() => assertLocalSupabase("http://localhost:55821")).not.toThrow());
  it("throws for an invalid URL", () => expect(() => assertLocalSupabase("")).toThrow());
});
