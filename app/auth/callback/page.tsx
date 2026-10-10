"use client";
import { useEffect, useState } from "react";
import { anonClient } from "@/lib/supabase";

export default function Callback() {
  const [msg, setMsg] = useState("Drafting you onto a team…");
  useEffect(() => {
    (async () => {
      const sb = anonClient();
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) await sb.auth.exchangeCodeForSession(code);
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return setMsg("Sign-in didn't finish. Try again from /join.");
      const res = await fetch("/api/join", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok) return setMsg(`Couldn't draft you: ${json.error}`);
      setMsg(`You're on ${json.team.name}. Go ship something.`);
    })();
  }, []);
  return <main className="center"><h1>{msg}</h1><a href="/">Watch the league live →</a></main>;
}
