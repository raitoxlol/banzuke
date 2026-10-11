"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AGENTS, agentLabel } from "@/lib/agents";
import { QUESTIONS, type Answers } from "@/lib/quiz";
import { APP_INSTALL, CLI_CONNECT, CLI_PREVIEW, STEPS, completeChoice, initialJoinState, parseAnswers, parseProgress, reduceJoin, type Step } from "@/lib/onboarding";

const TITLES: Record<Step, string> = { signIn: "GitHub account", agent: "Your agent", privateRepos: "Private repos", cliSetup: "CLI setup", cliConnect: "Connect CLI", finish: "Open the board" };
const storageKey = (login: string) => `banzuke.join.v1:${login.toLowerCase()}`;

function useJoinFlow() {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const join = useMutation(api.room.join);
  const install = useQuery(api.room.myInstall, isAuthenticated ? {} : "skip");
  const fuel = useQuery(api.fuel.myStatus, isAuthenticated ? {} : "skip");
  const board = useQuery(api.room.board, isAuthenticated ? {} : "skip");
  const [state, dispatch] = useReducer(reduceJoin, initialJoinState);
  const [notice, setNotice] = useState<{ epoch: number; text: string } | null>(null);
  const currentLogin = isAuthenticated && install?.login === fuel?.login ? install?.login ?? null : null;
  const current = useRef({ epoch: state.epoch, login: currentLogin, busy: false });
  if (current.current.epoch !== state.epoch || current.current.login !== currentLogin) current.current = { epoch: state.epoch, login: currentLogin, busy: false };
  const attempted = useRef(-1);
  useEffect(() => { dispatch({ type: "account", login: currentLogin }); }, [currentLogin]);
  useEffect(() => {
    if (!state.login || state.login !== currentLogin || state.hydrated) return;
    let progress = null, available = true;
    try { const value = localStorage.getItem(storageKey(state.login)); progress = value ? parseProgress(JSON.parse(value), state.login) : null; } catch { available = false; }
    dispatch({ type: "hydrate", epoch: state.epoch, progress, available });
  }, [state.login, state.epoch, state.hydrated, currentLogin]);
  useEffect(() => {
    if (!state.login || !state.hydrated || state.login !== currentLogin || !state.storageAvailable) return;
    try { localStorage.setItem(storageKey(state.login), JSON.stringify(state.progress)); } catch { dispatch({ type: "storageFailed" }); }
  }, [state.progress, state.login, state.hydrated, state.storageAvailable, currentLogin]);
  const save = useCallback(async (answers: Answers | null) => {
    if (!isAuthenticated || !currentLogin || state.login !== currentLogin || current.current.busy) return;
    const epoch = state.epoch, target = answers ? "choice" : "join";
    current.current.busy = true;
    dispatch({ type: "start", epoch, target });
    try {
      const result = await join(answers ? { answers } : {});
      if (result.login.toLowerCase() === currentLogin.toLowerCase()) dispatch({ type: "success", epoch, target });
      else dispatch({ type: "failure", epoch, target, answers, message: "Your GitHub account changed. Reload before retrying." });
    }
    catch { dispatch({ type: "failure", epoch, target, answers, message: answers ? "Your agent choice wasn't saved. Retry to save it." : "We couldn't put you on the board. Retry joining." }); }
    finally { if (current.current.epoch === epoch && current.current.login === currentLogin) current.current.busy = false; }
  }, [join, state.epoch, state.login, isAuthenticated, currentLogin]);
  useEffect(() => {
    if (!currentLogin || state.login !== currentLogin || attempted.current === state.epoch) return;
    attempted.current = state.epoch;
    void save(null);
  }, [currentLogin, state.login, state.epoch, save]);
  const player = board?.players.find((p) => p.login.toLowerCase() === currentLogin?.toLowerCase());
  const answers = parseAnswers(player?.answers);
  const joined = Boolean(currentLogin && state.login === currentLogin && (state.joined || install?.joined || player));
  const points = board && currentLogin ? board.plays.filter((p) => p.login.toLowerCase() === currentLogin.toLowerCase()).reduce((sum, p) => sum + p.points, 0) : null;
  const activeInstall = Boolean(currentLogin && install?.login === currentLogin && install.installations > 0);
  const historicalApp = Boolean(currentLogin && install?.login === currentLogin && install.webhookPlays > 0);
  const connected = Boolean(currentLogin && fuel?.login === currentLogin && fuel.connected);
  const copy = async (command: string) => {
    const epoch = state.epoch;
    try { await navigator.clipboard.writeText(command); if (current.current.epoch === epoch) setNotice({ epoch, text: "Copied. Run the command in your terminal." }); }
    catch { if (current.current.epoch === epoch) setNotice({ epoch, text: "Copy failed. Select the command and copy it manually, or retry Copy." }); }
  };
  const authenticate = async () => {
    const epoch = state.epoch;
    try { await signIn("github", { redirectTo: "/join" }); }
    catch { if (current.current.epoch === epoch) setNotice({ epoch, text: "GitHub sign-in couldn't start. Try Sign in with GitHub again." }); }
  };
  const evidence = (step: Step) => {
    if (step === "signIn") return joined ? "Joined" : "Waiting";
    if (step === "agent" && answers) return "Saved";
    if (step === "privateRepos" && activeInstall) return "Active App";
    if (step === "cliConnect" && connected) return "Connected";
    if (step === "cliSetup" && state.progress.cliReady) return "Ready";
    if (step !== "finish" && state.progress.skipped.includes(step)) return "Skipped";
    return step === "finish" ? "Finish" : "Optional";
  };
  return { state, dispatch, currentLogin, loading: isLoading || state.login !== currentLogin || (isAuthenticated && (install === undefined || fuel === undefined || (currentLogin !== null && !state.hydrated))), joined, points, answers, activeInstall, historicalApp, connected, lastSync: connected ? fuel?.lastSyncAt : null, busy: state.attempt.kind === "pending", copy, authenticate, save, evidence, notice: notice?.epoch === state.epoch ? notice.text : null };
}

export default function JoinLive({ icon }: { icon: React.ReactNode }) {
  const flow = useJoinFlow();
  const { state, dispatch, currentLogin, loading, joined, points, answers, activeInstall, historicalApp, connected, lastSync, busy } = flow;
  const [quiz, setQuiz] = useState<{ epoch: number; answers: Partial<Answers> } | null>(null);
  const picked = quiz?.epoch === state.epoch ? quiz.answers : null;
  const question = picked ? QUESTIONS.find((q) => !picked[q.key]) : null;
  const step = state.progress.step;
  const next = () => dispatch({ type: "go", step: STEPS[Math.min(5, STEPS.indexOf(step) + 1)] });
  const skip = () => { if (step !== "signIn" && step !== "finish") dispatch({ type: "skip", step }); };
  const retry = () => { if (state.attempt.kind === "failed") void flow.save(state.attempt.answers); };
  const chooseQuiz = (key: keyof Answers, value: string) => {
    const candidate = { ...picked, [key]: value };
    setQuiz({ epoch: state.epoch, answers: candidate });
    const complete = parseAnswers(candidate);
    if (complete) void flow.save(complete);
  };
  return <div className="join-flow">
    <ol className="join-progress" aria-label="Onboarding steps">
      {STEPS.map((s, index) => <li key={s}><button onClick={() => dispatch({ type: "go", step: s })} aria-current={s === step ? "step" : undefined} disabled={loading}>
        <span className="step-number">{index + 1}</span><span>{TITLES[s]}<small>{flow.evidence(s)}</small></span>
      </button></li>)}
    </ol>
    <section className="product-panel join-active" aria-labelledby="join-step-title">
      <div className="step-heading"><h2 id="join-step-title">{TITLES[step]}</h2><p>Step {STEPS.indexOf(step) + 1} of 6{step !== "signIn" && step !== "finish" ? " · Optional" : ""}</p></div>
      {currentLogin && <p className="join-account"><b>@{currentLogin}</b><span>{points === null ? "Loading your points…" : <><strong>{points}</strong> points on the room board</>}</span></p>}
      {loading ? <p role="status" className="product-empty">Loading your GitHub account…</p> : <>
        {step === "signIn" && <>
          <p>Sign in to join the room. New members start a public activity import from the last 72 hours.</p>
          {currentLogin ? <><p role="status">{joined ? "You're on the board. Your points update as public activity arrives." : busy ? "Putting you on the board…" : "Your account is signed in. Joining still needs to finish."}</p><p className="product-muted">The points above are the current room total. The import runs in the background.</p><button onClick={next} disabled={!joined || busy}>Done, choose an agent</button></> : <><button onClick={() => void flow.authenticate()}>{icon}Sign in with GitHub</button><button className="secondary" onClick={next}>Continue as a spectator</button></>}
        </>}
        {step === "agent" && <>
          <p>Pick where your commits count when they don't name an agent. Named agents in commits take priority.</p>
          {answers && <p className="product-confirmed">Saved on your account · {agentLabel(answers.tool)}</p>}
          {!currentLogin && <p className="product-muted">Sign in at step 1 to save a choice. You can keep exploring as a spectator.</p>}
          {picked ? <div className="join-quiz">
            {question ? <><p>Question {QUESTIONS.indexOf(question) + 1} of {QUESTIONS.length}</p><h3>{question.q}</h3><div className="choice-grid">{question.opts.map(([value, label]) => <button className="secondary" key={value} disabled={busy} onClick={() => chooseQuiz(question.key, value)}>{label}</button>)}</div></> : <p role="status">{busy ? "Saving your quiz answers…" : "Your quiz answers are ready to save."}</p>}
            <button className="text-button" disabled={busy} onClick={() => setQuiz(null)}>Back to direct choice</button>
          </div> : <><div className="choice-grid">{AGENTS.map((agent) => <button key={agent.id} className="secondary agent-choice" aria-pressed={answers?.tool === agent.id} disabled={busy || !joined} onClick={() => void flow.save(completeChoice(agent.id, answers))}><i style={{ background: agent.color }} aria-hidden="true" />{agent.label}</button>)}</div><p className="product-muted">Direct choice keeps your saved fun answers, or uses afternoon, accept all, and fix it myself.</p><button className="secondary" disabled={!joined || busy} onClick={() => setQuiz({ epoch: state.epoch, answers: {} })}>Take the four-question quiz</button></>}
          <div className="step-actions"><button onClick={next} disabled={!answers || busy}>Done</button><button className="text-button" onClick={skip} disabled={busy}>Skip for now</button></div>
        </>}
        {step === "privateRepos" && <>
          <p>Install the GitHub App on the repositories you want to score live, including private ones.</p><p className="product-muted">Private repository names and commit messages stay off the board.</p>
          <a className="product-button" href={APP_INSTALL} target="_blank" rel="noreferrer">Open GitHub App installation</a>
          <p role="status" className={activeInstall ? "product-confirmed" : "product-muted"}>{activeInstall ? "Active GitHub App installation recorded for this account." : "Waiting for an active GitHub App installation for this account."}</p>
          {historicalApp && <p>Previous GitHub App activity was recorded.{!activeInstall && " This doesn't confirm an active installation."}</p>}
          <p className="product-muted">Keep this page open and return after installing. Opening GitHub doesn't confirm installation.{!currentLogin && " Sign in first so we can check your account."}</p>
          <div className="step-actions"><button onClick={next} disabled={!activeInstall}>Done</button><button className="text-button" onClick={skip}>Skip for now</button></div>
        </>}
        {step === "cliSetup" && <>
          <p>Preview your local AI usage with the CLI. The browser can't check whether you've set it up.</p><p className="product-muted">Requires Node.js, GitHub CLI, and access to the private raitoxlol/banzuke repository. Browser sign-in doesn't grant repository access.</p>
          <pre><code>{CLI_PREVIEW}</code></pre><button className="secondary" onClick={() => void flow.copy(CLI_PREVIEW)}>Copy setup command</button>
          <p>The dry run shows what would be sent and sends nothing.</p><div className="step-actions"><button onClick={() => dispatch({ type: "ready" })}>I've run the preview</button><button className="text-button" onClick={skip}>Skip for now</button></div>
        </>}
        {step === "cliConnect" && <>
          <p>Run the CLI and approve sending your usage counts. Use the same GitHub account{currentLogin ? `, @${currentLogin}` : " as your browser sign-in"}.</p>
          <pre><code>{CLI_CONNECT}</code></pre><button className="secondary" onClick={() => void flow.copy(CLI_CONNECT)}>Copy connection command</button>
          <p className="product-muted">The CLI uses GITHUB_TOKEN first, then your GitHub CLI token. An environment token can select a different account. Only usage counts are sent.</p>
          <p role="status" className={connected ? "product-confirmed" : "product-muted"}>{connected ? `CLI usage received${lastSync ? ` · Last sync ${new Date(lastSync).toLocaleString()}` : ""}.` : "Waiting for usage counts from this account."}</p>
          {!connected && <p>No AI usage yet? A sync with no usage doesn't create a connection record. Run with <code>--watch</code> to wait for new usage, or skip and revisit later.</p>}
          {!currentLogin && <p className="product-muted">Sign in and join at step 1 before connecting the CLI.</p>}
          <div className="step-actions"><button onClick={next} disabled={!connected}>Done</button><button className="text-button" onClick={() => void flow.copy(CLI_CONNECT)}>Retry command</button><button className="text-button" onClick={skip}>Skip for now</button></div>
        </>}
        {step === "finish" && <>
          <h3>{joined ? "You're on the board." : "You're ready to spectate."}</h3><p>{joined ? "Go ship something. Your agent choice and confirmed integrations stay on your account." : "Watch the room, or revisit step 1 to sign in and join."}</p>
          <ul className="join-summary">{STEPS.slice(0, 5).map((s) => <li key={s}><span>{TITLES[s]}</span><span>{flow.evidence(s)}</span><button className="text-button" onClick={() => dispatch({ type: "go", step: s })}>Revisit</button></li>)}</ul>
          <a href="/" className="product-button">{joined ? "Open the room board" : "Spectate the room"}</a>
        </>}
      </>}
      {state.attempt.kind === "failed" && <div className="product-error" role="alert"><p>{state.attempt.message}</p><button className="secondary" onClick={retry}>Retry {state.attempt.target === "join" ? "joining" : "saving choice"}</button></div>}
      {flow.notice && <p role="status" className="product-notice">{flow.notice}</p>}
      {!state.storageAvailable && <p className="product-muted">Your browser couldn't save progress. This flow still works; a reload resets navigation and skips.</p>}
    </section>
  </div>;
}
