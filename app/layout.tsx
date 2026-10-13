import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { Toaster } from "@/components/ui/sonner";
import { es } from "@/lib/i18n/es";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Absolute base for canonical and Open Graph URLs (shared collection links).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: `${es.brand.name} | Cartas Digimon en México`, template: `%s | ${es.brand.name}` },
  description: es.brand.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
