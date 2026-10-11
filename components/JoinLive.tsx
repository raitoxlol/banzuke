"use client";
import { useEffect, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HEYA_STABLES } from "@/lib/firehose";

/** Sign in with GitHub (Convex Auth), then draft into a stable; backfill runs server-side. */
export default function JoinLive({ icon }: { icon: React.ReactNode }) {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const join = useMutation(api.room.join);
  const [msg, setMsg] = useState("");
  const once = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || once.current) return;
    once.current = true;
    setMsg("Drafting you into a stable…");
    join().then((r) => {
      const s = HEYA_STABLES[r.team];
      setMsg(`You're in ${s.name} ${s.jp}. ${r.fresh ? "Pulling your last 72h onto the board now." : "Welcome back."} Go ship something.`);
    }).catch((e) => setMsg(`Couldn't draft you: ${e.message}`));
  }, [isAuthenticated, join]);
  if (msg) return <p className="lede"><b>{msg}</b> <a href="/">Watch the board →</a></p>;
  return <button onClick={() => signIn("github", { redirectTo: "/join" })} disabled={isLoading}>{icon}Sign in with GitHub</button>;
}
