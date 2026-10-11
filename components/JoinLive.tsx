"use client";
import { resolveTeam, tallyTeams, TEAMS, TEAM_COLORS } from "@/lib/teams";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AGENTS, agentLabel } from "@/lib/agents";
import { QUESTIONS, type Answers } from "@/lib/quiz";
import { APP_INSTALL, CLI_CONNECT, CLI_PREVIEW, STEPS, completeChoice, initialJoinState, parseAnswers, parseProgress, reduceJoin, type Step } from "@/lib/onboarding";

const TITLES: Record<Step, string> = { signIn: "GitHubアカウント", agent: "エージェント", privateRepos: "非公開リポジトリ", cliSetup: "CLIの準備", cliConnect: "CLIを接続", finish: "番付を開く" };
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
      else dispatch({ type: "failure", epoch, target, answers, message: "GitHubアカウントが変わりました。ページを再読み込みしてから、もう一度お試しください。" });
    }
    catch { dispatch({ type: "failure", epoch, target, answers, message: answers ? "エージェントの選択を保存できませんでした。もう一度保存してください。" : "番付への登録に失敗しました。もう一度参加をお試しください。" }); }
    finally { if (current.current.epoch === epoch && current.current.login === currentLogin) current.current.busy = false; }
  }, [join, state.epoch, state.login, isAuthenticated, currentLogin]);
  useEffect(() => {
    if (!currentLogin || state.login !== currentLogin || attempted.current === state.epoch) return;
    attempted.current = state.epoch;
    void save(null);
  }, [currentLogin, state.login, state.epoch, save]);
  const player = board?.players.find((p) => p.login.toLowerCase() === currentLogin?.toLowerCase());
  const answers = parseAnswers(player?.answers);
  const side = (player as { side?: number } | undefined)?.side ?? null;
  const pickTeamM = useMutation(api.room.pickTeam);
  const pickTeam = useCallback((team: 0 | 1 | null) => pickTeamM({ team }).catch(() => undefined), [pickTeamM]);
  const tt = tallyTeams(board?.players ?? [], board?.plays ?? []);
  const teamPoints = [tt.sides[0].points, tt.sides[1].points];
  const joined = Boolean(currentLogin && state.login === currentLogin && (state.joined || install?.joined || player));
  const points = board && currentLogin ? board.plays.filter((p) => p.login.toLowerCase() === currentLogin.toLowerCase()).reduce((sum, p) => sum + p.points, 0) : null;
  const activeInstall = Boolean(currentLogin && install?.login === currentLogin && install.installations > 0);
  const historicalApp = Boolean(currentLogin && install?.login === currentLogin && install.webhookPlays > 0);
  const connected = Boolean(currentLogin && fuel?.login === currentLogin && fuel.connected);
  const copy = async (command: string) => {
    const epoch = state.epoch;
    try { await navigator.clipboard.writeText(command); if (current.current.epoch === epoch) setNotice({ epoch, text: "コピーしました。ターミナルでコマンドを実行してください。" }); }
    catch { if (current.current.epoch === epoch) setNotice({ epoch, text: "コピーできませんでした。コマンドを選択して手動でコピーするか、もう一度お試しください。" }); }
  };
  const authenticate = async () => {
    const epoch = state.epoch;
    try { await signIn("github", { redirectTo: "/join" }); }
    catch { if (current.current.epoch === epoch) setNotice({ epoch, text: "GitHubログインを開始できませんでした。「GitHubでログイン」をもう一度お試しください。" }); }
  };
  const evidence = (step: Step) => {
    if (step === "signIn") return joined ? "参加済み" : "待機中";
    if (step === "agent" && answers) return "保存済み";
    if (step === "privateRepos" && activeInstall) return "App連携済み";
    if (step === "cliConnect" && connected) return "接続済み";
    if (step === "cliSetup" && state.progress.cliReady) return "準備完了";
    if (step !== "finish" && state.progress.skipped.includes(step)) return "スキップ済み";
    return step === "finish" ? "完了" : "任意";
  };
  return { side, pickTeam, teamPoints, state, dispatch, currentLogin, loading: isLoading || state.login !== currentLogin || (isAuthenticated && (install === undefined || fuel === undefined || (currentLogin !== null && !state.hydrated))), joined, points, answers, activeInstall, historicalApp, connected, lastSync: connected ? fuel?.lastSyncAt : null, busy: state.attempt.kind === "pending", copy, authenticate, save, evidence, notice: notice?.epoch === state.epoch ? notice.text : null };
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
    <ol className="join-progress" aria-label="参加の手順">
      {STEPS.map((s, index) => <li key={s}><button onClick={() => dispatch({ type: "go", step: s })} aria-current={s === step ? "step" : undefined} disabled={loading}>
        <span className="step-number">{index + 1}</span><span>{TITLES[s]}<small>{flow.evidence(s)}</small></span>
      </button></li>)}
    </ol>
    <section className="product-panel join-active" aria-labelledby="join-step-title">
      <div className="step-heading"><h2 id="join-step-title">{TITLES[step]}</h2><p>手順 {STEPS.indexOf(step) + 1} / 6{step !== "signIn" && step !== "finish" ? " · 任意" : ""}</p></div>
      {currentLogin && <p className="join-account"><b>@{currentLogin}</b><span>{points === null ? "得点を読み込み中…" : <><strong>{points}</strong>点（会場の番付）</>}</span><span className="join-team" style={{ color: TEAM_COLORS[resolveTeam(currentLogin, flow.side)], fontWeight: 900 }}>所属：{TEAMS[resolveTeam(currentLogin, flow.side)]}</span></p>}
      {currentLogin && flow.joined && <div className="join-team-pick" style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, margin: "8px 0 16px" }}>
        {([0, 1] as const).map((t) => <button key={t} type="button" aria-pressed={resolveTeam(currentLogin, flow.side) === t} onClick={() => void flow.pickTeam(t)}
          style={{ background: TEAM_COLORS[t], color: "#fff", fontWeight: 900, fontSize: 20, padding: "14px 10px", borderRadius: 12, border: resolveTeam(currentLogin, flow.side) === t ? "3px solid #fff" : "3px solid transparent", opacity: resolveTeam(currentLogin, flow.side) === t ? 1 : 0.6 }}>
          {TEAMS[t]}<br /><small style={{ fontWeight: 700 }}>{flow.teamPoints[t]}点</small></button>)}
        <button type="button" className="secondary" aria-pressed={flow.side == null} onClick={() => void flow.pickTeam(null)}>ランダム</button>
      </div>}
      {loading ? <p role="status" className="product-empty">GitHubアカウントを読み込み中…</p> : <>
        {step === "signIn" && <>
          <p>ログインして会場に参加しましょう。新しく参加すると、過去72時間の公開活動の取り込みが始まります。</p>
          {currentLogin ? <><p role="status">{joined ? "番付に登録されました。公開活動が届くたびに得点が更新されます。" : busy ? "番付に登録中…" : "ログイン済みです。参加の登録はまだ完了していません。"}</p><p className="product-muted">上に表示されているのは現在の会場での合計得点です。活動の取り込みはバックグラウンドで進みます。</p><button onClick={next} disabled={!joined || busy}>次へ：エージェントを選ぶ</button></> : <><button onClick={() => void flow.authenticate()}>{icon}GitHubでログイン</button><button className="secondary" onClick={next}>観戦を続ける</button></>}
        </>}
        {step === "agent" && <>
          <p>コミットにエージェント名がない場合の集計先を選びます。コミットに記載されたエージェント名が優先されます。</p>
          {answers && <p className="product-confirmed">アカウントに保存済み · {answers.tool === "human" ? "手動・その他" : agentLabel(answers.tool)}</p>}
          {!currentLogin && <p className="product-muted">選択を保存するには手順1でログインしてください。ログインせずに観戦を続けることもできます。</p>}
          {picked ? <div className="join-quiz">
            {question ? <><p>質問 {QUESTIONS.indexOf(question) + 1} / {QUESTIONS.length}</p><h3>{question.q}</h3><div className="choice-grid">{question.opts.map(([value, label]) => <button className="secondary" key={value} disabled={busy} onClick={() => chooseQuiz(question.key, value)}>{label}</button>)}</div></> : <p role="status">{busy ? "回答を保存中…" : "回答の準備ができました。保存してください。"}</p>}
            <button className="text-button" disabled={busy} onClick={() => setQuiz(null)}>直接選択に戻る</button>
          </div> : <><div className="choice-grid">{AGENTS.map((agent) => <button key={agent.id} className="secondary agent-choice" aria-pressed={answers?.tool === agent.id} disabled={busy || !joined} onClick={() => void flow.save(completeChoice(agent.id, answers))}><i style={{ background: agent.color }} aria-hidden="true" />{agent.id === "human" ? "手動・その他" : agent.label}</button>)}</div><p className="product-muted">直接選択では保存済みの回答を引き継ぎます。未回答の場合は「午後3時」「すべて承認」「自分で直す」を使用します。</p><button className="secondary" disabled={!joined || busy} onClick={() => setQuiz({ epoch: state.epoch, answers: {} })}>4問のクイズに答える</button></>}
          <div className="step-actions"><button onClick={next} disabled={!answers || busy}>次へ</button><button className="text-button" onClick={skip} disabled={busy}>後で設定する</button></div>
        </>}
        {step === "privateRepos" && <>
          <p>非公開リポジトリを含め、リアルタイムで得点を集計したいリポジトリにGitHub Appをインストールしてください。</p><p className="product-muted">非公開リポジトリの名前やコミットメッセージは番付に表示されません。</p>
          <a className="product-button" href={APP_INSTALL} target="_blank" rel="noreferrer">GitHub Appのインストール画面を開く</a>
          <p role="status" className={activeInstall ? "product-confirmed" : "product-muted"}>{activeInstall ? "このアカウントの有効なGitHub App連携を確認しました。" : "このアカウントの有効なGitHub App連携を待っています。"}</p>
          {historicalApp && <p>過去のGitHub App経由の活動を確認しました。{!activeInstall && " 現在の連携が有効かどうかはまだ確認できていません。"}</p>}
          <p className="product-muted">このページを開いたまま、インストール後に戻ってください。GitHubを開くだけでは連携は完了しません。{!currentLogin && " アカウントの連携を確認するため、先にログインしてください。"}</p>
          <div className="step-actions"><button onClick={next} disabled={!activeInstall}>次へ</button><button className="text-button" onClick={skip}>後で設定する</button></div>
        </>}
        {step === "cliSetup" && <>
          <p>CLIでローカルのAI使用量を確認できます。設定が完了したかどうかはブラウザから確認できません。</p><p className="product-muted">Node.js、GitHub CLI、非公開のraitoxlol/banzukeリポジトリへのアクセス権が必要です。ブラウザでログインしても、リポジトリへのアクセス権は付与されません。</p>
          <pre><code>{CLI_PREVIEW}</code></pre><button className="secondary" onClick={() => void flow.copy(CLI_PREVIEW)}>準備コマンドをコピー</button>
          <p>プレビューでは送信予定の内容だけを表示し、データは送信しません。</p><div className="step-actions"><button onClick={() => dispatch({ type: "ready" })}>プレビューを実行しました</button><button className="text-button" onClick={skip}>後で設定する</button></div>
        </>}
        {step === "cliConnect" && <>
          <p>CLIを実行し、使用量の送信を承認してください。GitHubアカウントは同じものを使用します{currentLogin ? `（@${currentLogin}）` : "（ブラウザでログインしたアカウント）"}。</p>
          <pre><code>{CLI_CONNECT}</code></pre><button className="secondary" onClick={() => void flow.copy(CLI_CONNECT)}>接続コマンドをコピー</button>
          <p className="product-muted">CLIはGITHUB_TOKENを優先し、なければGitHub CLIのトークンを使用します。環境変数のトークンによって別のアカウントが選ばれることがあります。送信するのは使用量だけです。</p>
          <p role="status" className={connected ? "product-confirmed" : "product-muted"}>{connected ? `CLIの使用量を受信しました${lastSync ? ` · 最終同期 ${new Date(lastSync).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) + " JST"}` : ""}。` : "このアカウントからの使用量の送信を待っています。"}</p>
          {!connected && <p>AI使用量がまだない場合、使用量ゼロの同期では接続記録は作成されません。 <code>--watch</code>を付けて実行すると新しい使用量を待ち受けます。後で設定することもできます。</p>}
          {!currentLogin && <p className="product-muted">CLIを接続する前に、手順1でログインして参加してください。</p>}
          <div className="step-actions"><button onClick={next} disabled={!connected}>次へ</button><button className="text-button" onClick={() => void flow.copy(CLI_CONNECT)}>コマンドを再コピー</button><button className="text-button" onClick={skip}>後で設定する</button></div>
        </>}
        {step === "finish" && <>
          <h3>{joined ? "番付に参加しました。" : "観戦の準備ができました。"}</h3><p>{joined ? "開発を進めて得点を積み上げましょう。選んだエージェントと確認済みの連携はアカウントに保存されます。" : "会場を観戦するか、手順1に戻ってログインして参加しましょう。"}</p>
          <ul className="join-summary">{STEPS.slice(0, 5).map((s) => <li key={s}><span>{TITLES[s]}</span><span>{flow.evidence(s)}</span><button className="text-button" onClick={() => dispatch({ type: "go", step: s })}>設定に戻る</button></li>)}</ul>
          <a href="/" className="product-button">{joined ? "会場の番付を開く" : "会場を観戦する"}</a>
        </>}
      </>}
      {state.attempt.kind === "failed" && <div className="product-error" role="alert"><p>{state.attempt.message}</p><button className="secondary" onClick={retry}>{state.attempt.target === "join" ? "参加を再試行" : "選択の保存を再試行"}</button></div>}
      {flow.notice && <p role="status" className="product-notice">{flow.notice}</p>}
      {!state.storageAvailable && <p className="product-muted">ブラウザに進行状況を保存できませんでした。このまま続けられますが、再読み込みすると現在の手順とスキップの記録がリセットされます。</p>}
    </section>
  </div>;
}
