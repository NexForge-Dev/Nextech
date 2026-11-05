import { z } from "zod";
import { productInputSchema, type ProductInput, type ProductParsed } from "@/lib/admin/schemas/product";
import { slugify } from "./slug";

export type CatalogOption = { id: string; name: string; slug?: string };
export type ProductJsonCatalog = { categories: CatalogOption[]; brands: CatalogOption[]; suppliers: CatalogOption[] };
export type ProductJsonItem = { name: string; slug: string; payload: ProductParsed };
export type ProductJsonError = { line: number; message: string };
export type ProductJsonResult = { items: ProductJsonItem[]; errors: ProductJsonError[]; warnings: string[] };

const MAX_PRODUCTS = 200;

const emptySpec = { nome: "", valor: "" };
const emptyTranslation = { nome: "", descricao_curta: "", descricao: "", caracteristicas: [emptySpec] };

/** Field names follow the admin form, in Portuguese, so the owner and ChatGPT read the same labels. */
export const PRODUCT_JSON_TEMPLATE = {
  produtos: [
    {
      nome: "",
      slug: "",
      descricao_curta: "",
      descricao: "",
      caracteristicas: [emptySpec],
      categoria: "",
      marca: "",
      tags: [] as string[],
      modo_venda: "dropship",
      preco: "",
      preco_de: "",
      desconto_pix: 0,
      disponivel: true,
      estoque: null,
      entrega_min_dias: 3,
      entrega_max_dias: 7,
      fornecedores: [{ fornecedor: "", link: "", custo: "", principal: true, observacoes: "" }],
      avaliacao: "",
      quantidade_avaliacoes: "",
      fonte_avaliacao: "",
      garantia: "",
      sku: "",
      identificador_externo: "",
      caracteristicas_gerais: [emptySpec],
      status: "rascunho",
      destaque: false,
      traducoes: { "pt-PT": emptyTranslation, en: emptyTranslation, es: emptyTranslation },
    },
  ],
};

const listNames = (options: CatalogOption[]) => (options.length ? options.map((o) => `- ${o.slug ? `${o.slug} (${o.name})` : o.name}`).join("\n") : "- (nenhum cadastro)");

/** The text the owner pastes into ChatGPT: rules, the live catalog and the empty template. */
export function buildProductJsonPrompt(catalog: ProductJsonCatalog): string {
  return `Preencha o JSON abaixo com os produtos que vou te passar. Responda somente com o JSON, sem comentários.

Regras:
- Crie um item em "produtos" para cada produto. Não adicione nem renomeie campos.
- Não invente dados. Use só o que eu informar ou o que constar no material do produto. Se não souber, deixe o campo como está.
- Nunca invente preço, preço "de", custo, avaliação, quantidade de avaliações, estoque, prazo de entrega, garantia, certificação ou característica técnica.
- "nome": obrigatório, em português do Brasil. "preco": obrigatório, em reais, como "249,90".
- "slug": deixe vazio para gerar a partir do nome.
- "descricao": aceita Markdown simples: **negrito**, listas e títulos com ##.
- "descricao_curta": até 280 caracteres.
- "tags": letras minúsculas, números e hífens, como "sem-fio".
- "modo_venda": "dropship" (o fornecedor envia) ou "estoque" (sai do meu estoque). Em "estoque", preencha "estoque" com a quantidade.
- "preco_de": só se eu informar. Precisa ser maior que "preco".
- "garantia": só se eu informar, como "12 meses". Se não, deixe vazio.
- "avaliacao": de 0 a 5, só com "fonte_avaliacao" preenchida.
- "fornecedores": só se eu informar. Remova as linhas sem fornecedor.
- "status": "rascunho", "publicado" ou "arquivado". Use "rascunho", a menos que eu peça outro.
- "traducoes": preencha só se eu pedir.

Categorias aceitas em "categoria":
${listNames(catalog.categories)}

Marcas aceitas em "marca" (deixe vazio se não houver):
${listNames(catalog.brands)}

Fornecedores aceitos em "fornecedores":
${listNames(catalog.suppliers)}

Modelo:
${JSON.stringify(PRODUCT_JSON_TEMPLATE, null, 2)}

Produtos:
`;
}

const text = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v == null ? "" : String(v).trim()));
const days = z.union([z.number(), z.string()]).nullish();
const specs = z.array(z.strictObject({ nome: text, valor: text })).nullish();
const translation = z.strictObject({ nome: text, descricao_curta: text, descricao: text, caracteristicas: specs });

const productSchema = z.strictObject({
  nome: text,
  slug: text,
  descricao_curta: text,
  descricao: text,
  caracteristicas: specs,
  categoria: text,
  marca: text,
  tags: z.array(z.string()).nullish(),
  modo_venda: z.enum(["dropship", "estoque"]).nullish(),
  preco: text,
  preco_de: text,
  desconto_pix: text,
  disponivel: z.boolean().nullish(),
  estoque: text,
  entrega_min_dias: days,
  entrega_max_dias: days,
  fornecedores: z.array(z.strictObject({ fornecedor: text, link: text, custo: text, principal: z.boolean().nullish(), observacoes: text })).nullish(),
  avaliacao: text,
  quantidade_avaliacoes: text,
  fonte_avaliacao: text,
  garantia: text,
  sku: text,
  identificador_externo: text,
  caracteristicas_gerais: specs,
  status: z.enum(["rascunho", "publicado", "arquivado"]).nullish(),
  destaque: z.boolean().nullish(),
  traducoes: z.strictObject({ "pt-PT": translation.nullish(), en: translation.nullish(), es: translation.nullish() }).nullish(),
});
type JsonProduct = z.output<typeof productSchema>;
type JsonTranslation = z.output<typeof translation>;

const STATUS = { rascunho: "draft", publicado: "published", arquivado: "archived" } as const;

const toSpecs = (list: JsonProduct["caracteristicas"]) => (list ?? []).map((s) => ({ label: s.nome, value: s.valor }));
const toTranslation = (t: JsonTranslation) => ({ name: t.nome, shortDescription: t.descricao_curta, descriptionMd: t.descricao, specs: toSpecs(t.caracteristicas) });
const orDefault = (v: number | string | null | undefined, fallback: number) => (v == null || v === "" ? fallback : v);

/** Matches a slug or a display name, so "fones-de-ouvido" and "Fones de ouvido" find the same record. */
function findOption(options: CatalogOption[], value: string) {
  const key = slugify(value);
  return options.find((o) => (o.slug && slugify(o.slug) === key) || slugify(o.name) === key);
}

/** Wrapper-shape issues carry zod's English text; turn them into something the owner can act on. */
function describeShapeIssue(issue: z.core.$ZodIssue): string {
  const field = issue.path.join(".");
  if (issue.code === "unrecognized_keys") return `campo desconhecido: ${issue.keys.join(", ")}.`;
  return `o campo "${field}" tem um valor inválido.`;
}

function toInput(p: JsonProduct, catalog: ProductJsonCatalog): { input: ProductInput; problems: string[] } {
  const problems: string[] = [];
  const category = findOption(catalog.categories, p.categoria);
  if (!p.categoria) problems.push("informe a categoria.");
  else if (!category) problems.push(`categoria "${p.categoria}" não existe.`);
  const brand = p.marca ? findOption(catalog.brands, p.marca) : undefined;
  if (p.marca && !brand) problems.push(`marca "${p.marca}" não existe.`);

  const rows = (p.fornecedores ?? []).filter((s) => s.fornecedor);
  const suppliers = rows.flatMap((s) => {
    const found = findOption(catalog.suppliers, s.fornecedor);
    if (!found) {
      problems.push(`fornecedor "${s.fornecedor}" não existe.`);
      return [];
    }
    return [{ supplierId: found.id, url: s.link, cost: s.custo, isPrimary: rows.length === 1 || !!s.principal, notes: s.observacoes }];
  });

  const translations: ProductInput["translations"] = { "pt-BR": toTranslation({ nome: p.nome, descricao_curta: p.descricao_curta, descricao: p.descricao, caracteristicas: p.caracteristicas }) };
  for (const locale of ["pt-PT", "en", "es"] as const) {
    const t = p.traducoes?.[locale];
    if (t?.nome) translations[locale] = toTranslation(t);
  }

  return {
    problems,
    input: {
      slug: p.slug || slugify(p.nome),
      brandId: brand?.id ?? null,
      categoryId: category?.id ?? "",
      tags: p.tags ?? [],
      status: STATUS[p.status ?? "rascunho"],
      featured: p.destaque ?? false,
      sku: p.sku,
      warranty: p.garantia,
      externalId: p.identificador_externo,
      rating: p.avaliacao,
      ratingCount: p.quantidade_avaliacoes,
      ratingSource: p.fonte_avaliacao,
      specs: toSpecs(p.caracteristicas_gerais),
      translations,
      images: [],
      offers: [],
      saleMode: "own",
      sale: {
        price: p.preco,
        compareAt: p.preco_de,
        pixDiscountPct: p.desconto_pix || "0",
        available: p.disponivel ?? true,
        deliveryMinDays: orDefault(p.entrega_min_dias, 3),
        deliveryMaxDays: orDefault(p.entrega_max_dias, 7),
        fulfillment: p.modo_venda === "estoque" ? "stock" : "dropship",
        stock: p.estoque,
      },
      suppliers,
    },
  };
}

/** Chat answers often come with prose or code fences around the JSON. */
function extractJson(answer: string): string {
  const start = answer.search(/[[{]/);
  const end = Math.max(answer.lastIndexOf("}"), answer.lastIndexOf("]"));
  return start >= 0 && end > start ? answer.slice(start, end + 1) : answer;
}

export function parseProductsJson(answer: string, catalog: ProductJsonCatalog): ProductJsonResult {
  const fail = (message: string): ProductJsonResult => ({ items: [], errors: [{ line: 0, message }], warnings: [] });
  let data: unknown;
  try {
    data = JSON.parse(extractJson(answer));
  } catch {
    return fail("O texto não é um JSON válido. Copie a resposta do ChatGPT inteira e tente de novo.");
  }
  const list = Array.isArray(data) ? data : (data as { produtos?: unknown } | null)?.produtos;
  if (!Array.isArray(list) || list.length === 0) return fail('Nenhum produto encontrado em "produtos".');
  if (list.length > MAX_PRODUCTS) return fail(`Envie no máximo ${MAX_PRODUCTS} produtos por vez.`);

  const result: ProductJsonResult = { items: [], errors: [], warnings: [] };
  const seen = new Set<string>();
  list.forEach((entry, i) => {
    const rawName = (entry as { nome?: unknown } | null)?.nome;
    const label = typeof rawName === "string" && rawName.trim() ? rawName.trim() : `Produto ${i + 1}`;
    const report = (message: string) => result.errors.push({ line: 0, message: `${label}: ${message}` });

    const shape = productSchema.safeParse(entry);
    if (!shape.success) {
      shape.error.issues.forEach((issue) => report(describeShapeIssue(issue)));
      return;
    }
    const { input, problems } = toInput(shape.data, catalog);
    problems.forEach(report);
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      // toInput already reported the category with the value that failed
      parsed.error.issues.filter((issue) => issue.path[0] !== "categoryId").forEach((issue) => report(issue.code === "too_big" ? `o campo "${issue.path.join(".")}" passou do limite.` : issue.message));
    }
    if (problems.length || !parsed.success) return;

    if (seen.has(parsed.data.slug)) {
      report(`endereço "${parsed.data.slug}" repetido no arquivo.`);
      return;
    }
    seen.add(parsed.data.slug);
    result.items.push({ name: label, slug: parsed.data.slug, payload: parsed.data });
    if (parsed.data.status === "published") result.warnings.push(`${label}: será publicado sem imagens. Prefira "rascunho" até enviar as fotos.`);
  });
  return result;
}
