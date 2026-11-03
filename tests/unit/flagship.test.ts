import { describe, it, expect } from "vitest";
import { flagshipCandidates } from "@/lib/domain/flagship";

const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

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
