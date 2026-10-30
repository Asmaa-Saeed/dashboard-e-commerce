export const MOVEMENT_KINDS = {
  restock: "وصول بضاعة",
  manual_sale: "بيع مباشر من المتجر",
  return: "إرجاع قطعة",
  count: "جرد (العدد الفعلي)",
} as const;
export type MovementKind = keyof typeof MOVEMENT_KINDS;
