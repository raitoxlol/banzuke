"use client";
import { BRAND } from "@/lib/brand";
import { anonClient, hasSupabase } from "@/lib/supabase";

export default function Join() {
  async function signIn() {
    await anonClient().auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }
  return (
    <main className="center">
      <h1>Join {BRAND.name}</h1>
      <p>Sign in with GitHub. You get drafted onto a team, and every public push, merged PR and release scores for them live.</p>
      {hasSupabase() ? (
        <button onClick={signIn}>Sign in with GitHub</button>
      ) : (
        <p className="muted">Supabase isn&apos;t configured yet. Fill in .env.local (see README).</p>
      )}
      <p className="muted small">Then install the {BRAND.name} GitHub App on the repos you want to count.</p>
    </main>
  );
}
