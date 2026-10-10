import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "Pulse League", description: "Teams of builders compete live on what they ship." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
