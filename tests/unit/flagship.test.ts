import { describe, it, expect } from "vitest";
import { flagshipCandidates, flagshipLineup } from "@/lib/domain/flagship";

const rows = [{ id: "a", featured: true }, { id: "b", featured: false }, { id: "c", featured: true }];

describe("flagship candidates", () => {
  it("puts the picked product first and keeps the rest as fallback", () => {
    expect(flagshipCandidates(rows, "c").map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
  it("keeps the list when nothing is picked", () => {
    expect(flagshipCandidates(rows, "").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
  it("keeps the list when the picked product is no longer available", () => {
    expect(flagshipCandidates(rows, "gone").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("flagship lineup", () => {
  it("takes every highlighted product", () => {
    expect(flagshipLineup(rows, "").map((r) => r.id)).toEqual(["a", "c"]);
  });
  it("puts the picked product in front", () => {
    expect(flagshipLineup(rows, "c").map((r) => r.id)).toEqual(["c", "a"]);
  });
  it("keeps a picked product that isn't highlighted", () => {
    expect(flagshipLineup(rows, "b").map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
  it("is empty when nothing is highlighted", () => {
    expect(flagshipLineup([{ id: "a", featured: false }], "")).toEqual([]);
  });
});
