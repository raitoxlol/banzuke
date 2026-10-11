"use client";
import { useEffect, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { QUESTIONS, type Answers } from "@/lib/quiz";
import { agentLabel } from "@/lib/agents";

/** Sign in with GitHub (Convex Auth), take the sorting quiz (or skip), then join; backfill runs server-side. */
export default function JoinLive({ icon }: { icon: React.ReactNode }) {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const join = useMutation(api.room.join);
  const [msg, setMsg] = useState("");
  const [picked, setPicked] = useState<Partial<Answers>>({});
  const [skip, setSkip] = useState(false);
  const once = useRef(false);
  const done = QUESTIONS.every((q) => picked[q.key]);
  useEffect(() => {
    if (!isAuthenticated || once.current || !(done || skip)) return;
    once.current = true;
    setMsg("Putting you on the board…");
    join({ answers: skip ? undefined : (picked as Answers) }).then((r) => {
      setMsg(`You're racing${skip ? "" : ` for ${agentLabel((picked as Answers).tool)}`}. ${r.fresh ? "Pulling your last 72h onto the board now." : "Welcome back."} Go ship something.`);
    }).catch((e) => setMsg(`Couldn't join: ${e.message}`));
  }, [isAuthenticated, done, skip, picked, join]);
  if (msg) return <p className="lede"><b>{msg}</b> <a href="/">Watch the board →</a></p>;
  if (!isAuthenticated) return <button onClick={() => signIn("github", { redirectTo: "/join" })} disabled={isLoading}>{icon}Sign in with GitHub</button>;
  const q = QUESTIONS.find((x) => !picked[x.key]);
  if (!q || skip) return <p className="lede"><b>Putting you on the board…</b></p>;
  return (
    <div className="quiz">
      <p className="muted small">Question {QUESTIONS.indexOf(q) + 1} of {QUESTIONS.length}</p>
      <h2>{q.q}</h2>
      <div className="quiz-opts">
        {q.opts.map(([val, label]) => <button key={val} onClick={() => setPicked((p) => ({ ...p, [q.key]: val }))}>{label}</button>)}
      </div>
      <button className="link-btn muted small" onClick={() => setSkip(true)}>Skip, just draft me</button>
    </div>
  );
}
