// Run with: npm test (Node's built-in test runner, no extra packages).
import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "../src/lib/safe-redirect.ts";
import { telUrl, whatsappUrl } from "../src/lib/contact.ts";
import { readableTextColor, safeBrandColor } from "../src/lib/color.ts";
import { buildCsp } from "../src/lib/security/csp.ts";
import { buildDeliveryText } from "../src/features/orders/delivery-text.ts";
import { canMove, NEXT_STEP, ORDER_STATUSES, PREVIOUS_STEP } from "../src/features/orders/status.ts";

test("safeNextPath only allows paths inside the app", () => {
  assert.equal(safeNextPath("/s/shop/orders"), "/s/shop/orders");
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil", "/x\nLocation: y", "/a?u=https://x", undefined, 42]) {
    assert.equal(safeNextPath(bad), "/", String(bad));
  }
});

test("whatsappUrl normalises local and international numbers", () => {
  assert.equal(whatsappUrl("0599 123-456"), "https://wa.me/972599123456");
  assert.equal(whatsappUrl("+972598844197"), "https://wa.me/972598844197");
  assert.equal(whatsappUrl("00970599123456"), "https://wa.me/970599123456");
  assert.equal(whatsappUrl("javascript:alert(1)"), null);
  assert.equal(whatsappUrl("12"), null);
  assert.equal(telUrl("0599123456"), "tel:0599123456");
  assert.equal(telUrl("abc"), null);
});

test("brand colour helpers", () => {
  assert.equal(readableTextColor("#1f5c45"), "#ffffff");
  assert.equal(readableTextColor("#f5e663"), "#111111");
  assert.equal(safeBrandColor("red;}body{display:none"), "#1f5c45");
  assert.equal(safeBrandColor("#B7790F"), "#B7790F");
});

test("CSP pins scripts to the nonce and network calls to Supabase", () => {
  const csp = buildCsp({ nonce: "abc", supabaseUrl: "https://ref.supabase.co", isDev: false });
  assert.match(csp, /script-src 'self' 'nonce-abc' 'strict-dynamic';/);
  assert.match(csp, /connect-src 'self' https:\/\/ref\.supabase\.co wss:\/\/ref\.supabase\.co;/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /unsafe-eval/);
});

const order = {
  ref: "YH-1",
  customerName: "سماح",
  phone: "0599123456",
  phone2: null,
  city: "نابلس",
  address: "رفيديا",
  total: 255,
  currencySymbol: "₪",
  items: [{ name: "طقم طناجر", option: "بني", quantity: 1 }],
};

test("delivery text uses the default template", () => {
  const text = buildDeliveryText(order);
  assert.match(text, /طلب YH-1/);
  assert.match(text, /- طقم طناجر \(بني\) × 1/);
  assert.match(text, /255 ₪/);
});

test("delivery text replaces only known placeholders, as plain text", () => {
  assert.equal(buildDeliveryText(order, "{ref}|{constructor}|{unknown}|{name}"), "YH-1|{constructor}|{unknown}|سماح");
  assert.equal(buildDeliveryText({ ...order, customerName: "<script>x</script>" }, "{name}"), "<script>x</script>");
});

test("order buttons only offer moves the database allows", () => {
  for (const from of ORDER_STATUSES) {
    const next = NEXT_STEP[from];
    if (next) assert.ok(canMove(from, next.to), `${from} -> ${next.to}`);
    const prev = PREVIOUS_STEP[from];
    if (prev) assert.ok(canMove(from, prev), `${from} -> ${prev}`);
  }
  assert.equal(canMove("delivered", "pending_review"), false);
  assert.equal(canMove("cancelled", "delivered"), false);
});
