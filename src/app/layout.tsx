import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { PwaInstall } from "@/components/pwa/pwa-install";
import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "لوحة المتجر", template: "%s · لوحة المتجر" },
  robots: { index: false, follow: false },
  applicationName: "Flowpal",
  // iPhone: open full screen from the home screen, with the Flowpal name and icon.
  appleWebApp: { capable: true, title: "Flowpal", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={arabic.variable}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
        <PwaInstall />
      </body>
    </html>
  );
}
