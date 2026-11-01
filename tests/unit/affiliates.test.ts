import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { getAdapter } from "@/lib/affiliates/registry";

const fx = (f: string) => readFileSync(`tests/fixtures/affiliates/${f}`, "utf8");
const jsonFetch = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
const range = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-10-31T23:59:59Z") };

describe("amazon adapter", () => {
  const a = getAdapter("amazon");
  it("adds the market's tag", () => {
    const url = a.buildAffiliateUrl!("https://www.amazon.com.br/dp/B0X", { market: "BR", settings: { tag_BR: "nextech-20" } });
    expect(new URL(url).searchParams.get("tag")).toBe("nextech-20");
  });
  it("throws a readable error without a tag", () => {
    expect(() => a.buildAffiliateUrl!("https://www.amazon.com.br/dp/B0X", { market: "BR", settings: {} })).toThrow(/tag/i);
  });
  it("parses the Associates earnings report CSV", () => {
    const r = a.parseReportCsv!(fx("amazon-earnings.csv"), { currency: "BRL" });
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ status: "pending", saleAmountMinor: 19990, commissionMinor: 999, currency: "BRL" });
    expect(r.rows[1].status).toBe("rejected");
    expect(r.rows[0].externalId).not.toBe(r.rows[1].externalId);
  });
});

describe("awin adapter", () => {
  // Shape per Awin Publisher API GET /publishers/{publisherId}/transactions/ (https://wiki.awin.com/index.php/API_get_transactions_list)
  it("maps transactions", async () => {
    const rows = await getAdapter("awin").fetchConversions!(range, { token: "t" }, { publisherId: "123" }, jsonFetch(JSON.parse(fx("awin-transactions.json"))));
    expect(rows.map((r) => r.status)).toEqual(["confirmed", "pending", "rejected"]);
    expect(rows[0]).toMatchObject({ externalId: "900001", saleAmountMinor: 19990, commissionMinor: 999, currency: "EUR", clickRef: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    expect(rows[2].clickRef).toBeNull();
  });
  it("sends the bearer token and publisher id", async () => {
    let seen: Request | null = null;
    const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen = new Request(input, init);
      return new Response("[]", { status: 200 });
    }) as typeof fetch;
    await getAdapter("awin").fetchConversions!(range, { token: "secret-token" }, { publisherId: "123" }, f);
    expect(seen!.url).toContain("/publishers/123/transactions");
    expect(seen!.headers.get("authorization")).toBe("Bearer secret-token");
  });
});

describe("admitad adapter", () => {
  // Shape per Admitad publisher statistics/actions (https://developers.admitad.com/hc/en/articles/7930541032849)
  it("maps actions", async () => {
    const calls: string[] = [];
    const f = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/token/")) return new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 });
      return new Response(fx("admitad-actions.json"), { status: 200 });
    }) as typeof fetch;
    const rows = await getAdapter("admitad").fetchConversions!(range, { clientId: "id", clientSecret: "sec" }, {}, f);
    expect(rows.map((r) => r.status)).toEqual(["confirmed", "pending", "rejected", "confirmed"]);
    expect(rows[0]).toMatchObject({ externalId: "7001", saleAmountMinor: 129990, commissionMinor: 6500, currency: "BRL", clickRef: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
    expect(calls[0]).toContain("/token/");
  });
});

describe("impact adapter", () => {
  // Shape per impact.com Partner API GET /Mediapartners/{AccountSID}/Actions (https://integrations.impact.com/partner-api-reference/reference/actions)
  it("maps actions", async () => {
    const rows = await getAdapter("impact").fetchConversions!(range, { accountSid: "IR123", authToken: "x" }, {}, jsonFetch(JSON.parse(fx("impact-actions.json"))));
    expect(rows.map((r) => r.status)).toEqual(["confirmed", "pending", "rejected"]);
    expect(rows[0]).toMatchObject({ externalId: "1000.2000.3000", saleAmountMinor: 5999, commissionMinor: 300, currency: "USD", clickRef: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
  });
});

describe("generic adapter", () => {
  it("parses a CSV with a column mapping", () => {
    const csv = "pedido,data,situacao,valor,comissao,moeda,ref\nA1,2026-10-20,aprovado,100.00,5.00,BRL,dddddddd-dddd-4ddd-8ddd-dddddddddddd\nA2,2026-10-21,cancelado,50,2.5,BRL,";
    const r = getAdapter("generic").parseReportCsv!(csv, {
      mapping: { externalId: "pedido", date: "data", status: "situacao", saleAmount: "valor", commission: "comissao", currency: "moeda", clickRef: "ref" },
      statusMap: { aprovado: "confirmed", cancelado: "rejected" },
    });
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.status)).toEqual(["confirmed", "rejected"]);
    expect(r.rows[0].commissionMinor).toBe(500);
  });
  it("reports unmapped statuses", () => {
    const r = getAdapter("generic").parseReportCsv!("id,data,st,v,c,m\nX,2026-10-20,estranho,1,1,BRL", {
      mapping: { externalId: "id", date: "data", status: "st", saleAmount: "v", commission: "c", currency: "m" },
      statusMap: {},
    });
    expect(r.errors[0].line).toBe(2);
  });
});
