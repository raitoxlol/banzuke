"use client";
import { useConvexAuth } from "convex/react";

export default function JoinCta() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading || isAuthenticated) return null;
  return <a className="bzk-join-cta" href="/join">参加する</a>;
}
