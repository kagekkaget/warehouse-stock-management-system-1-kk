import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import TrakteerProvider from "@/components/trakteer-provider";

export const metadata: Metadata = {
  title: "StokPintar — Sistem Laporan Stok Gudang",
  description:
    "Kelola stok gudang, kedaluwarsa produk, pelanggan, pesanan, dan laporan PDF/CSV untuk mengurangi pemborosan barang.",
  applicationName: "StokPintar",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "StokPintar", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen text-slate-900 antialiased">
        <TrakteerProvider>{children}</TrakteerProvider>
      </body>
    </html>
  );
}