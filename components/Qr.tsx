"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Big QR to /join on this deployment's origin. */
export function JoinQr({ compact = false }: { compact?: boolean }) {
  const [svg, setSvg] = useState(""); const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${location.origin}/join`; setUrl(u.replace(/^https?:\/\//, ""));
    let mounted = true;
    QRCode.toString(u, { type: "svg", margin: 4, color: { dark: "#1B2521", light: "#F1EFE7" } }).then((code) => { if (mounted) setSvg(code); }).catch(() => { if (mounted) setSvg(""); });
    return () => { mounted = false; };
  }, []);
  if (compact) return <a className="bzk-join-qr" href="/join">
    <div className="bzk-join-copy"><b>参加する</b><span>QRコードから<br />GitHubでログイン</span></div>
    <div className="bzk-qr-code" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
  </a>;
  return (
    <div className="qr">
      <div className="qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="qr-copy"><b>QRコードから会場に参加</b><span className="num">{url}</span>
        <small className="muted">GitHubでログインすると過去72時間の活動を集計します。非公開リポジトリも名前を表示せず得点に加算します。</small></div>
    </div>
  );
}
