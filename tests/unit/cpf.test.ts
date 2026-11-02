import { describe, it, expect } from "vitest";
import { isValidCpf, onlyDigits } from "@/lib/domain/cpf";

describe("cpf", () => {
  it("accepts a valid CPF with or without punctuation", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });
  it("rejects wrong check digits, repeated digits and wrong length", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("1234")).toBe(false);
  });
  it("strips non-digits", () => expect(onlyDigits("01310-100")).toBe("01310100"));
});
