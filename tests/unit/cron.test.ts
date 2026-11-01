import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/sync/route";
import { cronAuthorized } from "@/lib/security/cron";

beforeAll(() => {
  process.env.CRON_SECRET = "s3cr3t-value";
});

describe("cron auth", () => {
  it("rejects a request without bearer", async () => {
    const res = await GET(new NextRequest("http://localhost/api/cron/sync"));
    expect(res.status).toBe(401);
  });
  it("rejects a wrong secret", () => {
    expect(cronAuthorized(new NextRequest("http://localhost/api/cron/sync", { headers: { authorization: "Bearer nope" } }))).toBe(false);
  });
  it("accepts the right secret", () => {
    expect(cronAuthorized(new NextRequest("http://localhost/api/cron/sync", { headers: { authorization: "Bearer s3cr3t-value" } }))).toBe(true);
  });
});
