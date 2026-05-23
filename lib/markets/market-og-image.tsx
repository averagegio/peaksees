import { ImageResponse } from "next/og";

import type { Market } from "@/lib/markets/store";

function formatEndsAtLabel(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function displayHost(siteHost: string) {
  return siteHost.replace(/^www\./, "");
}

export function marketOgImageResponse(market: Market, siteHost = "peaksees.com") {
  const yesPct = Math.round(Number(market.yesProbability) * 100);
  const noPct = 100 - yesPct;
  const question =
    market.question.length > 120 ? `${market.question.slice(0, 117)}…` : market.question;
  const host = displayHost(siteHost);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(145deg, #022c22 0%, #064e3b 38%, #0f172a 100%)",
          padding: "52px 56px",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            P
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>peaksees</div>
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.72)" }}>Prediction market</div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              fontSize: 17,
              fontWeight: 700,
              color: "#a7f3d0",
              background: "rgba(16,185,129,0.22)",
              border: "2px solid rgba(52,211,153,0.45)",
              padding: "10px 18px",
              borderRadius: 999,
            }}
          >
            {market.category}
          </div>
        </div>

        <div
          style={{
            marginTop: 40,
            fontSize: 46,
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: "-0.03em",
            maxHeight: 220,
            overflow: "hidden",
          }}
        >
          {question}
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 36, flex: 1, alignItems: "flex-end" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              background: "rgba(255,255,255,0.08)",
              border: "2px solid rgba(52,211,153,0.35)",
              borderRadius: 20,
              padding: "22px 26px",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: "#6ee7b7" }}>Yes</div>
            <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1 }}>{yesPct}%</div>
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              background: "rgba(255,255,255,0.06)",
              border: "2px solid rgba(255,255,255,0.16)",
              borderRadius: 20,
              padding: "22px 26px",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>No</div>
            <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1 }}>{noPct}%</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 28,
            fontSize: 19,
            fontWeight: 600,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <span>Settles {formatEndsAtLabel(market.endsAt)}</span>
          <span>{host}</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
