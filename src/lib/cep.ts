export type CepAddress = { street: string; district: string; city: string; state: string };

/** Address for a Brazilian CEP via ViaCEP (public, no key). Null when unknown or unreachable. */
export async function lookupCep(cep: string, fetchImpl: typeof fetch = fetch): Promise<CepAddress | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const res = await fetchImpl(`https://viacep.com.br/ws/${digits}/json/`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { erro?: unknown; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    if (j.erro) return null;
    return { street: j.logradouro ?? "", district: j.bairro ?? "", city: j.localidade ?? "", state: (j.uf ?? "").toUpperCase() };
  } catch {
    return null;
  }
}
