/**
 * Builds a wa.me link from a local or international number.
 * Local numbers (05…) get the store's country code. Returns null for anything that is not a phone number.
 */
export function whatsappUrl(phone: string | null | undefined, countryCode = "972"): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = countryCode + digits.slice(1);
  if (!/^\d{8,15}$/.test(digits)) return null;
  return `https://wa.me/${digits}`;
}

export function telUrl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{7,15}$/.test(cleaned) ? `tel:${cleaned}` : null;
}
