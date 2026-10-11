"use client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { CONVEX_URL } from "@/lib/convex";

const client = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;

/** No NEXT_PUBLIC_CONVEX_URL = demo mode: no provider, boards use demo data. */
export function Providers({ children }: { children: ReactNode }) {
  return client ? <ConvexAuthProvider client={client}>{children}</ConvexAuthProvider> : <>{children}</>;
}
