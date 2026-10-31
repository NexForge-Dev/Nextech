import { describe, it, expect } from "vitest";
import { serviceClient, uniq } from "./helpers";

describe("rate_limit_hit", () => {
  it("allows up to max hits per window, then blocks", async () => {
    const svc = serviceClient();
    const key = uniq("rl");
    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const { data } = await svc.rpc("rate_limit_hit", { p_key: key, p_window_seconds: 60, p_max: 5 });
      results.push(data as boolean);
    }
    expect(results).toEqual([true, true, true, true, true, false]);
    const { data: other } = await svc.rpc("rate_limit_hit", { p_key: uniq("rl"), p_window_seconds: 60, p_max: 5 });
    expect(other).toBe(true);
  });
  it("is not callable by anon", async () => {
    const { anonClient } = await import("./helpers");
    const { error } = await anonClient().rpc("rate_limit_hit", { p_key: "x", p_window_seconds: 60, p_max: 5 });
    expect(error).not.toBeNull();
  });
});
