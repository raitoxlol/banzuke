"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Big QR to /join on this deployment's origin. */
export function JoinQr() {
  const [svg, setSvg] = useState(""); const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${location.origin}/join`; setUrl(u.replace(/^https?:\/\//, ""));
    QRCode.toString(u, { type: "svg", margin: 1, color: { dark: "#0B0D12", light: "#F2F4F8" } }).then(setSvg);
  }, []);
  return (
    <div className="qr">
      <div className="qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="qr-copy"><b>Scan to join the room</b><span className="num">{url}</span>
        <small className="muted">Sign in with GitHub. Your last 72h count. Private repos score without showing names.</small></div>
    </div>
  );
}
