import { admitadAdapter } from "./admitad";
import { amazonAdapter } from "./amazon";
import { amazonPaapiAdapter } from "./amazon-paapi";
import { awinAdapter } from "./awin";
import { genericAdapter } from "./generic";
import { impactAdapter } from "./impact";
import type { AdapterKey, AffiliateAdapter } from "./types";

const ADAPTERS: Record<AdapterKey, AffiliateAdapter> = {
  amazon: amazonAdapter,
  amazon_paapi: amazonPaapiAdapter,
  awin: awinAdapter,
  admitad: admitadAdapter,
  impact: impactAdapter,
  generic: genericAdapter,
};

export function getAdapter(key: string): AffiliateAdapter {
  return ADAPTERS[key as AdapterKey] ?? genericAdapter;
}

export const ADAPTER_KEYS = Object.keys(ADAPTERS) as AdapterKey[];
