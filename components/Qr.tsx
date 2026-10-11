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
    <div className="bzk-join-copy"><b>Join the match</b><span>Scan to sign in<br />with GitHub</span></div>
    <div className="bzk-qr-code" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
  </a>;
  return (
    <div className="qr">
      <div className="qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="qr-copy"><b>Scan to join the room</b><span className="num">{url}</span>
        <small className="muted">Sign in with GitHub. Your last 72h count. Private repos score without showing names.</small></div>
    </div>
  );
}
