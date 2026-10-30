// Order steps. The allowed moves mirror the database trigger in supabase/02_security_and_logic.sql,
// so the UI only offers buttons the database will accept.

export const ORDER_STATUSES = ["pending_review", "confirmed", "shipped", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_review: "بانتظار المراجعة",
  confirmed: "مؤكد",
  shipped: "عند شركة التوصيل",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

export const STATUS_TONE: Record<OrderStatus, "warning" | "info" | "accent" | "success" | "danger"> = {
  pending_review: "warning",
  confirmed: "info",
  shipped: "accent",
  delivered: "success",
  cancelled: "danger",
};

/** Orders that still need work, shown as columns on the board. */
export const ACTIVE_STATUSES = ["pending_review", "confirmed", "shipped"] as const satisfies readonly OrderStatus[];
export const DONE_STATUSES = ["delivered", "cancelled"] as const satisfies readonly OrderStatus[];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_review: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled", "pending_review"],
  shipped: ["delivered", "cancelled", "confirmed"],
  delivered: ["shipped"],
  cancelled: ["pending_review"],
};

export function canMove(from: OrderStatus, to: OrderStatus) {
  return TRANSITIONS[from].includes(to);
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** The main forward step, shown as the primary button. */
export const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  pending_review: { to: "confirmed", label: "تأكيد الطلب" },
  confirmed: { to: "shipped", label: "سُلِّم لشركة التوصيل" },
  shipped: { to: "delivered", label: "سُلِّم للعميل" },
};

/** One step back, for mistakes. */
export const PREVIOUS_STEP: Partial<Record<OrderStatus, OrderStatus>> = {
  confirmed: "pending_review",
  shipped: "confirmed",
  delivered: "shipped",
  cancelled: "pending_review",
};
