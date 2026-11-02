import { setBusinessModels, svc } from "./support";

/** The pre-existing specs exercise the affiliate model; own-store specs switch it off themselves. */
export default async function globalSetup() {
  await setBusinessModels({ ownStore: true, affiliates: true });
  // repeated local runs would otherwise trip the sign-in/sign-up rate limits
  await svc().from("rate_limits").delete().neq("key", "");
}
