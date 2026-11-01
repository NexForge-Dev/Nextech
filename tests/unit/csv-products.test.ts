import { describe, it, expect } from "vitest";
import { parseProductsCsv, toProductsCsv, PRODUCT_CSV_COLUMNS } from "@/lib/domain/csv";

const header = PRODUCT_CSV_COLUMNS.join(",");

describe("products CSV", () => {
  it("groups rows with the same slug into one product with several offers", () => {
    const text = [
      header,
      "fone-x,published,eletronicos,marca-x,audio|bluetooth,SKU1,Fone X,Curto,Desc,,,,loja-a,BR,BRL,https://a.com/1,,199.90,,false,,",
      "fone-x,published,eletronicos,marca-x,audio|bluetooth,SKU1,Fone X,Curto,Desc,,,,loja-b,BR,BRL,https://b.com/1,,189.90,,false,,",
    ].join("\n");
    const r = parseProductsCsv(text);
    expect(r.errors).toEqual([]);
    expect(r.products).toHaveLength(1);
    expect(r.products[0].offers).toHaveLength(2);
    expect(r.products[0].offers[1].priceMinor).toBe(18990);
    expect(r.products[0].tags).toEqual(["audio", "bluetooth"]);
  });
  it("reports a bad price with its line number", () => {
    const text = [header, "fone-x,draft,eletronicos,,,,Fone X,,,,,,loja-a,BR,BRL,https://a.com/1,,abc,,false,,"].join("\n");
    const r = parseProductsCsv(text);
    expect(r.errors[0]).toMatchObject({ line: 2 });
    expect(r.errors[0].message).toMatch(/preço/i);
  });
  it("rejects a missing required column", () => {
    const r = parseProductsCsv("slug,status\nx,draft");
    expect(r.errors[0].line).toBe(1);
  });
  it("exports and re-imports the same data", () => {
    const text = [header, "fone-x,published,eletronicos,marca-x,audio,SKU1,Fone X,Curto,Desc,Auscultador X,Headphones X,Auriculares X,loja-a,PT,EUR,https://a.com/1,https://a.com/1?aff=1,49.90,59.90,true,https://a.com/historico,https://img.com/a.jpg"].join("\n");
    const first = parseProductsCsv(text);
    const again = parseProductsCsv(toProductsCsv(first.products));
    expect(again.errors).toEqual([]);
    expect(again.products).toEqual(first.products);
  });
});
