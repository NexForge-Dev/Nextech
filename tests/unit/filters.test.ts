import { describe, it, expect } from "vitest";
import { parseFilters, serializeFilters } from "@/lib/domain/filters";

const sp = (s: string) => new URLSearchParams(s);

describe("catalog filters", () => {
  it("trims q to 100 chars", () => expect(parseFilters(sp("q=" + "a".repeat(500))).q?.length).toBe(100));
  it("drops invalid numbers and sorts", () => {
    const f = parseFilters(sp("min=abc&sort=hack"));
    expect(f.min).toBeUndefined();
    expect(f.sort).toBe("recent");
  });
  it("defaults sort to relevance when searching", () => expect(parseFilters(sp("q=fone")).sort).toBe("relevance"));
  it("rejects relevance sort without a query", () => expect(parseFilters(sp("sort=relevance")).sort).toBe("recent"));
  it("parses money in major units to minor", () => {
    const f = parseFilters(sp("min=10&max=99.9"));
    expect(f.min).toBe(1000);
    expect(f.max).toBe(9990);
  });
  it("clamps page to >= 1", () => expect(parseFilters(sp("page=-3")).page).toBe(1));
  it("validates slugs", () => expect(parseFilters(sp("brand=../../etc")).brand).toBeUndefined());
  it("parses rating 1-5 only", () => {
    expect(parseFilters(sp("rating=4")).rating).toBe(4);
    expect(parseFilters(sp("rating=9")).rating).toBeUndefined();
  });
  it("parses discount flag", () => expect(parseFilters(sp("discount=1")).discount).toBe(true));
  it("roundtrips stably and omits defaults", () => {
    const f = parseFilters(sp("sort=price_asc&q=fone&page=2&brand=x&discount=1"));
    const s = serializeFilters(f);
    expect(s).toBe("q=fone&brand=x&discount=1&sort=price_asc&page=2");
    expect(parseFilters(sp(s))).toEqual(f);
    expect(serializeFilters(parseFilters(sp("")))).toBe("");
  });
});
