"use client";
import { useEffect } from "react";

export default function BridgePage() {
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (e.data?.type !== "save-zip") return;
      const { base64 } = e.data;
      const res = await fetch("/api/dev/save-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64 }),
      });
      const result = await res.json();
      window.opener?.postMessage({ type: "save-zip-done", result }, "*");
    };
    window.addEventListener("message", handler);
    // Signal ready
    window.opener?.postMessage({ type: "bridge-ready" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);
  return <p style={{ fontFamily: "monospace", padding: 20 }}>Bridge ready. Waiting for data...</p>;
}
