import { isAgent, type Agent } from "./agents";
import type { Answers } from "./quiz";

export const STEPS = ["signIn", "privateRepos", "cliSetup", "cliConnect", "finish"] as const;
export type Step = typeof STEPS[number];
export type OptionalStep = Exclude<Step, "signIn" | "finish">;
export type Progress = { version: 1; login: string; step: Step; skipped: OptionalStep[]; cliReady: boolean };
export type Attempt = { kind: "idle" } | { kind: "pending"; target: "join" | "choice" }
  | { kind: "failed"; target: "join" | "choice"; message: string; answers: Answers | null };
export type JoinState = { epoch: number; login: string | null; progress: Progress; hydrated: boolean; attempt: Attempt; joined: boolean; storageAvailable: boolean };
export type JoinEvent = { type: "account"; login: string | null }
  | { type: "hydrate"; epoch: number; progress: Progress | null; available: boolean }
  | { type: "go"; step: Step } | { type: "skip"; step: OptionalStep } | { type: "ready" }
  | { type: "start"; epoch: number; target: "join" | "choice" }
  | { type: "success"; epoch: number; target: "join" | "choice" }
  | { type: "failure"; epoch: number; target: "join" | "choice"; message: string; answers: Answers | null }
  | { type: "storageFailed" };
const empty = (login: string): Progress => ({ version: 1, login, step: "signIn", skipped: [], cliReady: false });
export const initialJoinState: JoinState = { epoch: 0, login: null, progress: empty(""), hydrated: true, attempt: { kind: "idle" }, joined: false, storageAvailable: true };
export function parseProgress(input: unknown, login: string): Progress | null {
  if (!input || typeof input !== "object" || !("version" in input) || !("login" in input) || !("step" in input) || !("skipped" in input) || !("cliReady" in input)) return null;
  if (input.version !== 1 || input.login !== login || !isStep(input.step) || !Array.isArray(input.skipped)
    || !input.skipped.every(isOptional) || typeof input.cliReady !== "boolean") return null;
  return { version: 1, login, step: input.step, skipped: [...new Set(input.skipped)], cliReady: input.cliReady };
}
function isStep(value: unknown): value is Step { return STEPS.some((step) => step === value); }
function isOptional(value: unknown): value is OptionalStep { return isStep(value) && value !== "signIn" && value !== "finish"; }
export function completeChoice(tool: Agent, saved: Answers | null): Answers {
  return { tool, hour: saved?.hour ?? "3pm", indent: saved?.indent ?? "spaces", friday: saved?.friday ?? "no" };
}
export function parseAnswers(input: unknown): Answers | null {
  if (!input || typeof input !== "object" || !("tool" in input) || !("hour" in input) || !("indent" in input) || !("friday" in input)) return null;
  const { tool, hour, indent, friday } = input;
  return isAgent(tool) && (hour === "3am" || hour === "3pm") && (indent === "tabs" || indent === "spaces") && (friday === "yes" || friday === "no") ? { tool, hour, indent, friday } : null;
}
export function reduceJoin(state: JoinState, event: JoinEvent): JoinState {
  if ("epoch" in event && event.epoch !== state.epoch) return state;
  switch (event.type) {
    case "account": return event.login === state.login ? state : { ...initialJoinState, epoch: state.epoch + 1, login: event.login, progress: empty(event.login ?? ""), hydrated: event.login === null };
    case "hydrate": return { ...state, hydrated: true, progress: event.progress ?? state.progress, storageAvailable: event.available };
    case "go": return { ...state, progress: { ...state.progress, step: event.step } };
    case "skip": return { ...state, progress: { ...state.progress, skipped: [...new Set([...state.progress.skipped, event.step])], step: STEPS[STEPS.indexOf(event.step) + 1] } };
    case "ready": return { ...state, progress: { ...state.progress, cliReady: true, skipped: state.progress.skipped.filter((s) => s !== "cliSetup"), step: "cliConnect" } };
    case "start": return { ...state, attempt: { kind: "pending", target: event.target } };
    case "success": return { ...state, attempt: { kind: "idle" }, joined: true, progress: event.target === "choice" ? { ...state.progress, step: "privateRepos", skipped: state.progress.skipped } : state.progress };
    case "failure": return { ...state, attempt: { kind: "failed", target: event.target, message: event.message, answers: event.answers } };
    case "storageFailed": return { ...state, storageAvailable: false };
  }
}
export const CLI_PREVIEW = "gh repo clone raitoxlol/banzuke && node banzuke/cli/banzuke.mjs --dry-run";
export const CLI_CONNECT = "node banzuke/cli/banzuke.mjs --full --onboard";
export const APP_INSTALL = "https://github.com/apps/banzukeboard/installations/new";
