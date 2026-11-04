import { CircleCheck, CircleSlash, Clock, Package, RotateCcw, Truck } from "lucide-react";
import type { CustomerStage } from "@/lib/domain/order-status";

const STAGE = {
  awaiting_payment: { Icon: Clock, cls: "" },
  preparing: { Icon: Package, cls: "" },
  shipped: { Icon: Truck, cls: "" },
  delivered: { Icon: CircleCheck, cls: "tag-solid" },
  cancelled: { Icon: CircleSlash, cls: "tag-soft" },
  refunded: { Icon: RotateCcw, cls: "tag-soft" },
} as const;

/** Customer-facing order stage: icon and fill carry the state (the palette is monochrome). */
export function OrderStageTag({ stage, label, ...rest }: { stage: CustomerStage; label: string; "data-testid"?: string }) {
  const { Icon, cls } = STAGE[stage];
  return (
    <span className={`tag ${cls}`} {...rest}>
      <Icon strokeWidth={2} aria-hidden />
      {label}
    </span>
  );
}
