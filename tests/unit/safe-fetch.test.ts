import { describe, it, expect } from "vitest";
import { fetchPublicHttps, isPrivateIp } from "@/lib/security/safe-fetch";

describe("isPrivateIp", () => {
  it("flags internal ranges and cloud metadata", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) expect(isPrivateIp(ip), ip).toBe(true);
  });
  it("lets public addresses through", () => {
    for (const ip of ["8.8.8.8", "151.101.1.69", "2606:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
});

describe("fetchPublicHttps", () => {
  const ok = new Response("img", { status: 200 });
  it("refuses http and hosts resolving to private addresses", async () => {
    const f = async () => ok;
    expect(await fetchPublicHttps("http://cdn.example.com/a.png", {}, { fetch: f as never, resolve: async () => ["8.8.8.8"] })).toBeNull();
    expect(await fetchPublicHttps("https://internal.example.com/a.png", {}, { fetch: f as never, resolve: async () => ["10.0.0.5"] })).toBeNull();
    expect(await fetchPublicHttps("https://169.254.169.254/latest", {}, { fetch: f as never })).toBeNull();
  });
  it("re-checks every redirect hop", async () => {
    const f = async (u: URL) => (u.hostname === "cdn.example.com" ? new Response(null, { status: 302, headers: { location: "https://metadata.internal/x" } }) : ok);
    const resolve = async (h: string) => (h === "cdn.example.com" ? ["8.8.8.8"] : ["169.254.169.254"]);
    expect(await fetchPublicHttps("https://cdn.example.com/a.png", {}, { fetch: f as never, resolve })).toBeNull();
  });
  it("returns the response for a public https host", async () => {
    const res = await fetchPublicHttps("https://cdn.example.com/a.png", {}, { fetch: (async () => ok) as never, resolve: async () => ["8.8.8.8"] });
    expect(res?.status).toBe(200);
  });
});
