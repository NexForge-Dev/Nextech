/** "Produto enviado" needs a tracking code on every item (the customer sees one per item). */
export function canShip(items: { trackingCode: string | null }[]): boolean {
  return items.length > 0 && items.every((i) => !!i.trackingCode?.trim());
}

export function refundableMinor(o: { totalMinor: number; refundedMinor: number; paid: boolean }): number {
  return o.paid ? Math.max(0, o.totalMinor - o.refundedMinor) : 0;
}
