import { describe, it, expect, vi } from "vitest";
import { feedbackSchema, FEEDBACK_MAX_MESSAGE, pathOnly, submitFeedbackWith, type FeedbackForward } from "@/lib/domain/feedback";

const valid = { kind: "problem", message: "  O filtro não funciona.  ", page: "/pt-BR/ofertas?token=abc#topo" };
const USER = "11111111-1111-4111-8111-111111111111";
const ROW = "22222222-2222-4222-8222-222222222222";
const AT = "2026-11-05T10:00:00.000Z";

function deps(over: Partial<Parameters<typeof submitFeedbackWith>[0]> = {}) {
  return {
    user: vi.fn(async () => ({ id: USER })),
    allow: vi.fn(async () => true),
    save: vi.fn(async () => ({ id: ROW, createdAt: AT })),
    forward: vi.fn(async () => undefined),
    onForwardError: vi.fn(),
    ...over,
  };
}

describe("feedback schema", () => {
  it("trims the message", () => expect(feedbackSchema.parse(valid).message).toBe("O filtro não funciona."));
  it("accepts both kinds", () => {
    for (const kind of ["suggestion", "problem"]) expect(feedbackSchema.safeParse({ ...valid, kind }).success).toBe(true);
  });
  it("rejects an unknown kind", () => expect(feedbackSchema.safeParse({ ...valid, kind: "praise" }).success).toBe(false));
  it("rejects an empty message", () => expect(feedbackSchema.safeParse({ ...valid, message: "" }).success).toBe(false));
  it("rejects a blank message", () => expect(feedbackSchema.safeParse({ ...valid, message: " \n\t " }).success).toBe(false));
  it("accepts exactly the maximum", () => expect(feedbackSchema.safeParse({ ...valid, message: "a".repeat(FEEDBACK_MAX_MESSAGE) }).success).toBe(true));
  it("rejects one character over the maximum", () => expect(feedbackSchema.safeParse({ ...valid, message: "a".repeat(FEEDBACK_MAX_MESSAGE + 1) }).success).toBe(false));
  it("measures the maximum after trimming", () => expect(feedbackSchema.safeParse({ ...valid, message: ` ${"a".repeat(FEEDBACK_MAX_MESSAGE)} ` }).success).toBe(true));
  it("works without a page", () => expect(feedbackSchema.parse({ kind: "suggestion", message: "Oi" }).page).toBe(""));
});

describe("pathOnly", () => {
  it("drops the query string", () => expect(pathOnly("/pt-BR/busca?q=ana@example.com")).toBe("/pt-BR/busca"));
  it("drops the fragment", () => expect(pathOnly("/pt-BR/ofertas#topo")).toBe("/pt-BR/ofertas"));
  it("refuses anything that is not a path", () => expect(pathOnly("https://evil.example/x")).toBe(""));
  it("limits the length", () => expect(pathOnly(`/${"a".repeat(500)}`)).toHaveLength(300));
});

describe("submitFeedbackWith", () => {
  it("refuses without a session and touches nothing", async () => {
    const d = deps({ user: vi.fn(async () => null) });
    expect(await submitFeedbackWith(d, valid)).toEqual({ ok: false, error: "unauthenticated" });
    expect(d.allow).not.toHaveBeenCalled();
    expect(d.save).not.toHaveBeenCalled();
  });

  it("does not spend the limit on invalid input", async () => {
    const d = deps();
    expect(await submitFeedbackWith(d, { ...valid, message: "   " })).toEqual({ ok: false, error: "invalid" });
    expect(d.allow).not.toHaveBeenCalled();
  });

  it("stops at the rate limit, counted per user", async () => {
    const d = deps({ allow: vi.fn(async () => false) });
    expect(await submitFeedbackWith(d, valid)).toEqual({ ok: false, error: "rate_limited" });
    expect(d.allow).toHaveBeenCalledWith(USER);
    expect(d.save).not.toHaveBeenCalled();
  });

  it("does not forward what could not be saved", async () => {
    const d = deps({ save: vi.fn(async () => null) });
    expect(await submitFeedbackWith(d, valid)).toEqual({ ok: false, error: "server" });
    expect(d.forward).not.toHaveBeenCalled();
  });

  it("saves first, then forwards the row id", async () => {
    const order: string[] = [];
    const d = deps({
      save: vi.fn(async () => (order.push("save"), { id: ROW, createdAt: AT })),
      forward: vi.fn(async () => void order.push("forward")),
    });
    expect(await submitFeedbackWith(d, valid)).toEqual({ ok: true });
    expect(order).toEqual(["save", "forward"]);
    expect(d.save).toHaveBeenCalledWith({ userId: USER, kind: "problem", message: "O filtro não funciona.", page: "/pt-BR/ofertas" });
  });

  it("sends NexForge only the row id, the message and the path, never the author", async () => {
    const forward = vi.fn<(item: FeedbackForward) => Promise<void>>(async () => undefined);
    await submitFeedbackWith(deps({ forward }), valid);
    const item = forward.mock.calls[0][0];
    expect(item).toEqual({ externalId: ROW, kind: "problem", message: "O filtro não funciona.", page: "/pt-BR/ofertas", occurredAt: new Date(AT) });
    expect(JSON.stringify(item)).not.toContain(USER);
  });

  it("still succeeds when NexForge fails, and reports the failure", async () => {
    const boom = new Error("down");
    const d = deps({ forward: vi.fn(async () => Promise.reject(boom)) });
    expect(await submitFeedbackWith(d, valid)).toEqual({ ok: true });
    expect(d.onForwardError).toHaveBeenCalledWith(boom);
  });
});
