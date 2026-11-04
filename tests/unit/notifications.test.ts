import { describe, it, expect } from "vitest";
import { computeNotifications, type NotificationInput } from "@/lib/domain/notifications";

const NOW = new Date("2026-10-31T12:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();
const inH = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString();

function input(p: Partial<NotificationInput> = {}): NotificationInput {
  return { now: NOW, staleDays: 14, offers: [], schedules: [], failedSyncs: [], unhandledMessages: 0, productsWithoutOffer: [], ...p };
}

describe("own-store notifications", () => {
  it("links new feedback to the filtered admin page, and stays quiet without any", () => {
    const n = computeNotifications(input({ newFeedback: 3 }));
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ kind: "feedback", href: "/admin/feedback?status=new", key: "feedback:3" });
    expect(computeNotifications(input({ newFeedback: 0 }))).toEqual([]);
  });
  it("counts orders to buy and open returns", async () => {
    const { computeNotifications } = await import("@/lib/domain/notifications");
    const n = computeNotifications({ now: new Date("2026-11-02T12:00:00Z"), staleDays: 14, offers: [], schedules: [], failedSyncs: [], unhandledMessages: 0, productsWithoutOffer: [], ordersToBuy: 2, openReturns: 1 });
    expect(n.map((x) => x.kind).sort()).toEqual(["orders_to_buy", "returns_open"]);
    expect(n.find((x) => x.kind === "orders_to_buy")?.href).toBe("/admin/pedidos?status=awaiting_supplier");
  });
});

describe("computeNotifications", () => {
  it("flags a priced offer older than the stale threshold", () => {
    const n = computeNotifications(input({ offers: [{ id: "o1", productId: "p1", productName: "Fone", priceUpdatedAt: ago(15 * 24), policy: "show", hasPrice: true }] }));
    expect(n.filter((x) => x.kind === "stale")).toHaveLength(1);
  });
  it("ignores link_only offers", () => {
    const n = computeNotifications(input({ offers: [{ id: "o1", productId: "p1", productName: "Fone", priceUpdatedAt: ago(30 * 24), policy: "link_only", hasPrice: false }] }));
    expect(n).toHaveLength(0);
  });
  it("warns about schedules ending within 48 h only", () => {
    const n = computeNotifications(input({ schedules: [
      { kind: "banner", id: "b1", name: "Banner A", startsAt: ago(100), endsAt: inH(30) },
      { kind: "banner", id: "b2", name: "Banner B", startsAt: ago(100), endsAt: inH(72) },
    ] }));
    expect(n.map((x) => x.kind)).toEqual(["ending"]);
  });
  it("warns about schedules starting within 48 h", () => {
    const n = computeNotifications(input({ schedules: [{ kind: "promotion", id: "x", name: "Promo", startsAt: inH(10), endsAt: inH(100) }] }));
    expect(n[0].kind).toBe("starting");
  });
  it("has stable keys across calls", () => {
    const i = input({ offers: [{ id: "o1", productId: "p1", productName: "Fone", priceUpdatedAt: ago(20 * 24), policy: "show", hasPrice: true }] });
    expect(computeNotifications(i)[0].key).toBe(computeNotifications(i)[0].key);
  });
  it("reports messages, failed syncs and products without offers", () => {
    const n = computeNotifications(input({ unhandledMessages: 3, failedSyncs: [{ networkId: "n1", networkName: "Awin", at: ago(2) }], productsWithoutOffer: [{ id: "p9", name: "Sem oferta" }] }));
    expect(n.map((x) => x.kind).sort()).toEqual(["messages", "no_offer", "sync_failed"]);
  });
});
