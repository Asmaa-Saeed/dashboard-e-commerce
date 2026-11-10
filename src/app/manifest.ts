import type { MetadataRoute } from "next";

// Lets the dashboard be installed on a phone like an app (Add to Home Screen).
// Served at /manifest.webmanifest; the proxy lets it through without a session.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Flowpal",
    short_name: "Flowpal",
    description: "لوحة المتجر: الطلبات والمحادثات والمنتجات",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
