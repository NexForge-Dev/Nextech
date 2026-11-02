import { describe, it, expect } from "vitest";
import { lookupCep } from "@/lib/cep";

const ok = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

describe("lookupCep", () => {
  it("maps the ViaCEP response", async () => {
    const r = await lookupCep("01310-100", ok({ logradouro: "Avenida Paulista", bairro: "Bela Vista", localidade: "São Paulo", uf: "SP" }));
    expect(r).toEqual({ street: "Avenida Paulista", district: "Bela Vista", city: "São Paulo", state: "SP" });
  });
  it("returns null for an unknown CEP", async () => expect(await lookupCep("00000000", ok({ erro: true }))).toBeNull());
  it("returns null for a malformed CEP without calling the service", async () => {
    let called = false;
    expect(await lookupCep("123", (async () => ((called = true), new Response("{}"))) as unknown as typeof fetch)).toBeNull();
    expect(called).toBe(false);
  });
  it("returns null when the service fails", async () => expect(await lookupCep("01310100", (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toBeNull());
});
