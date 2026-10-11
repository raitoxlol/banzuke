import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import { Providers } from "@/components/Providers";

export const metadata = { title: BRAND.name, description: BRAND.tagline };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className={`${sans.variable} ${mono.variable}`}><body><Providers>{children}</Providers><Analytics /></body></html>;
}
