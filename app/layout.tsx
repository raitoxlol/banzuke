import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Barlow, Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const broadcast = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-barlow" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-barlow-condensed" });
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { Providers } from "@/components/Providers";

export const metadata = { title: BRAND.name, description: BRAND.tagline };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ja" className={`${sans.variable} ${mono.variable} ${broadcast.variable} ${display.variable}`}><body><Providers>{children}</Providers><Analytics /></body></html>;
}
