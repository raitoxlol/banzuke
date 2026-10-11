import { BRAND } from "@/lib/brand";
export function ProductHeader({ current }: { current: "join" | "global" }) {
  return <header className="product-header">
    <a className="product-brand" href="/">{BRAND.name.toUpperCase()} <span lang="ja">番付</span></a>
    <nav aria-label="メインナビゲーション">
      <a href="/">会場</a><a href="/global" aria-current={current === "global" ? "page" : undefined}>世界の活動</a>
      <a href="/join" aria-current={current === "join" ? "page" : undefined}>参加する</a>
    </nav>
  </header>;
}
