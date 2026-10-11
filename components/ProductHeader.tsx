import { BRAND } from "@/lib/brand";
export function ProductHeader({ current }: { current: "join" | "global" }) {
  return <header className="product-header">
    <a className="product-brand" href="/">{BRAND.name.toUpperCase()} <span lang="ja">番付</span></a>
    <nav aria-label="Main navigation">
      <a href="/">Room</a><a href="/global" aria-current={current === "global" ? "page" : undefined}>Global</a>
      <a href="/join" aria-current={current === "join" ? "page" : undefined}>Join</a>
    </nav>
  </header>;
}
