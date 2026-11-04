import { describe, it, expect } from "vitest";
import { buildProductJsonPrompt, parseProductsJson, PRODUCT_JSON_TEMPLATE } from "@/lib/domain/product-json";

const CATEGORY = "11111111-1111-4111-8111-111111111111";
const BRAND = "22222222-2222-4222-8222-222222222222";
const SUPPLIER = "33333333-3333-4333-8333-333333333333";
const catalog = {
  categories: [{ id: CATEGORY, slug: "fones-de-ouvido", name: "Fones de ouvido" }],
  brands: [{ id: BRAND, slug: "movespeed", name: "Movespeed" }],
  suppliers: [{ id: SUPPLIER, name: "AliExpress" }],
};
const minimal = { nome: "Fone Bluetooth X", categoria: "fones-de-ouvido", preco: "249,90" };
const parse = (produtos: unknown[]) => parseProductsJson(JSON.stringify({ produtos }), catalog);

describe("products JSON import", () => {
  it("creates a draft dropshipping product from the minimum fields", () => {
    const r = parse([minimal]);
    expect(r.errors).toEqual([]);
    expect(r.items).toHaveLength(1);
    const p = r.items[0].payload;
    expect(p.slug).toBe("fone-bluetooth-x");
    expect(p.status).toBe("draft");
    expect(p.saleMode).toBe("own");
    expect(p.images).toEqual([]);
    expect(p.sale).toMatchObject({ priceMinor: 24990, fulfillment: "dropship", available: true, deliveryMinDays: 3, deliveryMaxDays: 7 });
  });

  it("maps every form field", () => {
    const r = parse([
      {
        nome: "Fone Bluetooth X",
        slug: "fone-x",
        descricao_curta: "Curta",
        descricao: "**Longa**",
        caracteristicas: [{ nome: "Bluetooth", valor: "5.3" }],
        categoria: "Fones de ouvido",
        marca: "movespeed",
        tags: ["bluetooth", "sem-fio"],
        modo_venda: "estoque",
        preco: 249.9,
        preco_de: "299,90",
        desconto_pix: 5,
        disponivel: false,
        estoque: 12,
        entrega_min_dias: 2,
        entrega_max_dias: 5,
        fornecedores: [{ fornecedor: "aliexpress", link: "https://example.com/p", custo: "100,50", observacoes: "Nota" }],
        avaliacao: "4,5",
        quantidade_avaliacoes: 10,
        fonte_avaliacao: "Mercado Livre",
        sku: "SKU1",
        identificador_externo: "EXT1",
        caracteristicas_gerais: [{ nome: "Peso", valor: "50 g" }],
        status: "publicado",
        destaque: true,
        traducoes: { en: { nome: "X Headset", descricao_curta: "Short", descricao: "Long", caracteristicas: [{ nome: "Weight", valor: "50 g" }] } },
      },
    ]);
    expect(r.errors).toEqual([]);
    const p = r.items[0].payload;
    expect(p).toMatchObject({ slug: "fone-x", brandId: BRAND, categoryId: CATEGORY, tags: ["bluetooth", "sem-fio"], status: "published", featured: true, sku: "SKU1", externalId: "EXT1", rating: 4.5, ratingCount: 10, ratingSource: "Mercado Livre" });
    expect(p.sale).toMatchObject({ priceMinor: 24990, compareAtMinor: 29990, pixDiscountPct: 5, available: false, deliveryMinDays: 2, deliveryMaxDays: 5, fulfillment: "stock", stockQuantity: 12 });
    expect(p.suppliers).toEqual([{ supplierId: SUPPLIER, url: "https://example.com/p", costMinor: 10050, isPrimary: true, notes: "Nota" }]);
    expect(p.specs).toEqual([{ label: "Peso", value: "50 g" }]);
    expect(p.translations["pt-BR"]).toEqual({ name: "Fone Bluetooth X", shortDescription: "Curta", descriptionMd: "**Longa**", specs: [{ label: "Bluetooth", value: "5.3" }] });
    expect(p.translations.en?.name).toBe("X Headset");
  });

  it("accepts the answer wrapped in chat text and code fences", () => {
    const r = parseProductsJson('Aqui está:\n```json\n{"produtos":[{"nome":"Fone X","categoria":"fones-de-ouvido","preco":"10"}]}\n```\nEspero que ajude!', catalog);
    expect(r.errors).toEqual([]);
    expect(r.items).toHaveLength(1);
  });

  it("ignores blank template rows", () => {
    const r = parse([{ ...minimal, marca: "", caracteristicas: [{ nome: "", valor: "" }], fornecedores: [{ fornecedor: "", link: "", custo: "" }], avaliacao: "", estoque: null, traducoes: { en: { nome: "" } } }]);
    expect(r.errors).toEqual([]);
    const p = r.items[0].payload;
    expect(p.brandId).toBeNull();
    expect(p.suppliers).toEqual([]);
    expect(p.translations["pt-BR"]?.specs).toEqual([]);
    expect(p.translations.en).toBeUndefined();
  });

  it("names the product and the problem in each error", () => {
    expect(parseProductsJson("isto não é json", catalog).errors[0].message).toMatch(/JSON/);
    expect(parseProductsJson('{"produtos":[]}', catalog).errors[0].message).toMatch(/nenhum produto/i);
    expect(parse([{ ...minimal, categoria: "nao-existe" }]).errors[0].message).toBe('Fone Bluetooth X: categoria "nao-existe" não existe.');
    expect(parse([{ ...minimal, marca: "nao-existe" }]).errors[0].message).toBe('Fone Bluetooth X: marca "nao-existe" não existe.');
    expect(parse([{ ...minimal, fornecedores: [{ fornecedor: "nao-existe" }] }]).errors[0].message).toBe('Fone Bluetooth X: fornecedor "nao-existe" não existe.');
    expect(parse([{ nome: "Fone X", categoria: "fones-de-ouvido" }]).errors[0].message).toBe("Fone X: Informe o preço de venda.");
    expect(parse([{ ...minimal, modo_venda: "estoque" }]).errors[0].message).toBe("Fone Bluetooth X: Informe a quantidade em estoque.");
    expect(parse([{ ...minimal, preco_de: "100" }]).errors[0].message).toMatch(/preço “de” precisa ser maior/);
    expect(parse([{ ...minimal, imagens: ["https://example.com/a.jpg"] }]).errors[0].message).toMatch(/imagens/);
    expect(parse([{ ...minimal, status: "ativo" }]).errors[0].message).toMatch(/status/);
  });

  it("rejects the same slug twice in a file and returns the valid products apart", () => {
    const r = parse([minimal, minimal, { ...minimal, nome: "Fone Y" }]);
    expect(r.errors.map((e) => e.message)).toEqual(['Fone Bluetooth X: endereço "fone-bluetooth-x" repetido no arquivo.']);
    expect(r.items.map((i) => i.slug)).toEqual(["fone-bluetooth-x", "fone-y"]);
  });

  it("warns when a product would go live without images", () => {
    expect(parse([{ ...minimal, status: "publicado" }]).warnings[0]).toMatch(/sem imagens/);
    expect(parse([minimal]).warnings).toEqual([]);
  });

  it("gives a template that parses and a prompt with the real catalog and no invented data", () => {
    const prompt = buildProductJsonPrompt(catalog);
    for (const text of ["fones-de-ouvido", "Movespeed", "AliExpress", "Não invente"]) expect(prompt).toContain(text);
    expect(prompt).toContain(JSON.stringify(PRODUCT_JSON_TEMPLATE, null, 2));
    const r = parseProductsJson(JSON.stringify(PRODUCT_JSON_TEMPLATE), catalog);
    expect(r.errors.some((e) => /desconhecido/.test(e.message))).toBe(false);
  });
});
