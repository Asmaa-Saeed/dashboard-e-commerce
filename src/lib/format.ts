const DEFAULT_TIMEZONE = "Asia/Hebron";

export function formatMoney(amount: number | null | undefined, symbol = "₪") {
  if (amount === null || amount === undefined) return "—";
  const value = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
  return `${value} ${symbol}`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDateTime(iso: string | null | undefined, timeZone = DEFAULT_TIMEZONE) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined, timeZone = DEFAULT_TIMEZONE) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );
}

/** "منذ 5 د" / "منذ 3 س" / a date for anything older than a day. */
export function formatTimeAgo(iso: string | null | undefined, timeZone = DEFAULT_TIMEZONE, now = Date.now()) {
  if (!iso) return "—";
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} د`;
  if (minutes < 24 * 60) return `منذ ${Math.floor(minutes / 60)} س`;
  return formatDateTime(iso, timeZone);
}
