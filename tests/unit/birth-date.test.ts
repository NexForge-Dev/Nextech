import { describe, it, expect } from "vitest";
import { ageOn, brazilToday, isAdult, isValidBirthDate } from "@/lib/domain/birth-date";

describe("birth date", () => {
  it("validates real calendar dates only", () => {
    expect(isValidBirthDate("2000-02-29", "2026-11-05")).toBe(true);
    expect(isValidBirthDate("2001-02-29", "2026-11-05")).toBe(false);
    expect(isValidBirthDate("20/05/1990", "2026-11-05")).toBe(false);
    expect(isValidBirthDate("2026-11-06", "2026-11-05")).toBe(false);
    expect(isValidBirthDate("1899-12-31", "2026-11-05")).toBe(false);
  });
  it("turns 18 exactly on the birthday", () => {
    expect(isAdult("2008-11-05", "2026-11-05")).toBe(true);
    expect(isAdult("2008-11-06", "2026-11-05")).toBe(false);
  });
  it("counts a 29 February birthday from 1 March on non-leap years", () => {
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageOn("2008-02-29", "2026-03-01")).toBe(18);
  });
  it("uses the Brazilian calendar day", () => {
    expect(brazilToday(new Date("2026-11-05T02:00:00Z"))).toBe("2026-11-04");
  });
});
