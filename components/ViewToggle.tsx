export function ViewToggle({ view }: { view: "room" | "global" }) {
  return (
    <nav className="view-toggle" aria-label="Board">
      <a href="/" className={view === "room" ? "on" : ""}>Room</a>
      <a href="/global" className={view === "global" ? "on" : ""}>Global firehose</a>
    </nav>
  );
}
