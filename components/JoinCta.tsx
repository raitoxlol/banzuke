"use client";
import { useConvexAuth } from "convex/react";

export default function JoinCta() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading || isAuthenticated) return null;
  return (
    <>
      <style>{`.join-cta{display:none}@media (max-width:900px){.join-cta{display:block}}`}</style>
      <a className="join-cta" href="/join" style={{ margin: "0 0 20px", padding: "18px 20px", borderRadius: 12, background: "var(--pulse)", color: "var(--bg)", fontWeight: 700, fontSize: 20, textAlign: "center", textDecoration: "none" }}>
        Get on the board →
      </a>
    </>
  );
}
