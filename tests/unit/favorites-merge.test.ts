import { describe, it, expect } from "vitest";
import { mergeFavorites } from "@/lib/domain/favorites-merge";
import { safeNextPath } from "@/lib/domain/safe-next";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("mergeFavorites", () => {
  it("inserts only new valid ids", () => expect(mergeFavorites([A, B, "junk"], [A]).toInsert).toEqual([B]));
  it("dedupes local ids", () => expect(mergeFavorites([B, B], []).toInsert).toEqual([B]));
});

describe("safeNextPath", () => {
  it("accepts same-origin paths", () => expect(safeNextPath("/pt-br/minha-conta")).toBe("/pt-br/minha-conta"));
  it("rejects protocol-relative URLs", () => expect(safeNextPath("//evil.com")).toBeNull());
  it("rejects absolute URLs", () => expect(safeNextPath("https://evil.com")).toBeNull());
  it("rejects backslash tricks", () => expect(safeNextPath(String.raw`/\evil.com`)).toBeNull());
  it("rejects empty", () => expect(safeNextPath(null)).toBeNull());
});
