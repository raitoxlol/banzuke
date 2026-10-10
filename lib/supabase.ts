import { createClient, SupabaseClient } from "@supabase/supabase-js";

export function hasSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Browser/anon client: read-only realtime for the broadcast page. */
export function anonClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/** Server-only client with the service role, used by the webhook. */
export function serviceClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

export type PulseEvent = {
  id: number;
  created_at: string;
  kind: "push" | "pr_merged" | "release";
  points: number;
  player_login: string;
  team_id: number;
  repo: string;
  summary: string;
  lat: number;
  lng: number;
};

export type Team = { id: number; name: string; color: string; score: number };
