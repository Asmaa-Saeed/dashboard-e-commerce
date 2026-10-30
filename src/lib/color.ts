/** Black or white, whichever reads better on the given brand colour (WCAG relative luminance). */
export function readableTextColor(hex: string): "#ffffff" | "#111111" {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return "#ffffff";
  const value = parseInt(match[1], 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#111111";
}

export function safeBrandColor(hex: string | null | undefined, fallback = "#1f5c45") {
  return hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback;
}
