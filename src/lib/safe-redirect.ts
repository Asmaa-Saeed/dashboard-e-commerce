/**
 * Only allows redirects to paths inside this app, so a link like /login?next=https://evil.example
 * cannot send someone to another site after they log in.
 */
export function safeNextPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(next) || next.includes("://")) return fallback;
  return next;
}
