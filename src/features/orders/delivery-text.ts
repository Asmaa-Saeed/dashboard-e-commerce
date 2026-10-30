export type DeliveryTextInput = {
  ref: string;
  customerName: string;
  phone: string;
  phone2: string | null;
  city: string | null;
  address: string | null;
  total: number;
  currencySymbol: string;
  items: Array<{ name: string; option: string | null; quantity: number }>;
};

export const DEFAULT_DELIVERY_TEMPLATE = [
  "طلب {ref}",
  "الاسم: {name}",
  "الهاتف: {phone}",
  "العنوان: {city} - {address}",
  "المنتجات:",
  "{items}",
  "المبلغ المطلوب: {total} (شامل التوصيل)",
  "الدفع عند الاستلام",
].join("\n");

/**
 * Plain-text summary for a delivery company. Placeholders are replaced as plain text only,
 * so nothing a customer typed can turn into markup.
 */
export function buildDeliveryText(input: DeliveryTextInput, template: string | null = null): string {
  const items = input.items
    .map((item) => `- ${item.name}${item.option ? ` (${item.option})` : ""} × ${item.quantity}`)
    .join("\n");
  const phones = input.phone2 ? `${input.phone} / ${input.phone2}` : input.phone;
  const values: Record<string, string> = {
    ref: input.ref,
    name: input.customerName,
    phone: phones,
    city: input.city ?? "",
    address: input.address ?? "",
    items,
    total: `${input.total} ${input.currencySymbol}`,
  };
  return (template?.trim() || DEFAULT_DELIVERY_TEMPLATE).replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? values[key] : match,
  );
}
