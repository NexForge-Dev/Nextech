import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/domain/report-csv";

describe("toCsv", () => {
  const cols = [{ key: "a", header: "Coluna A" }, { key: "b", header: "Coluna B" }];
  it("uses ; as separator and a BOM", () => {
    const csv = toCsv([{ a: 1, b: "x" }], cols);
    expect(csv.startsWith("﻿Coluna A;Coluna B\r\n")).toBe(true);
    expect(csv).toContain("1;x");
  });
  it("guards against CSV injection", () => expect(toCsv([{ a: "=HYPERLINK(\"x\")", b: "" }], cols)).toContain(`"'=HYPERLINK(""x"")"`));
  it("doubles quotes and quotes cells with separators or newlines", () => {
    const csv = toCsv([{ a: 'diz "oi"', b: "linha1\nlinha2;x" }], cols);
    expect(csv).toContain(`"diz ""oi"""`);
    expect(csv).toContain(`"linha1\nlinha2;x"`);
  });
  it("renders null as empty", () => expect(toCsv([{ a: null, b: 2 }], cols)).toContain("\r\n;2"));
});
