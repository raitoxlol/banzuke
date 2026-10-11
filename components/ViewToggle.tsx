export function ViewToggle({ view }: { view: "room" | "global" }) {
  return (
    <nav className="view-toggle" aria-label="番付の表示">
      <a href="/" className={view === "room" ? "on" : ""}>会場</a>
      <a href="/global" className={view === "global" ? "on" : ""}>世界の活動</a>
    </nav>
  );
}
