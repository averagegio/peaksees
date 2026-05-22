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

export function marketOgImageResponse(market: Market) {
  const yesPct = Math.round(Number(market.yesProbability) * 100);
  const noPct = 100 - yesPct;
  const question =
    market.question.length > 140 ? `${market.question.slice(0, 137)}…` : market.question;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #ecfdf5 0%, #f4f4f5 45%, #eef2ff 100%)",
          padding: 48,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            background: "rgba(255,255,255,0.97)",
            borderRadius: 28,
            border: "2px solid rgba(16,185,129,0.25)",
            boxShadow: "0 24px 60px rgba(15,23,42,0.12)",
            padding: "40px 44px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: "#059669",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              P
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#18181b" }}>peaksees</div>
              <div style={{ fontSize: 18, color: "#71717a" }}>{market.category}</div>
            </div>
            <div
              style={{
                marginLeft: "auto",
                fontSize: 16,
                fontWeight: 700,
                color: "#047857",
                background: "rgba(16,185,129,0.12)",
                padding: "8px 16px",
                borderRadius: 999,
              }}
            >
              Prediction market
            </div>
          </div>

          <div
            style={{
              marginTop: 28,
              fontSize: 42,
              fontWeight: 700,
              lineHeight: 1.15,
              color: "#09090b",
              letterSpacing: "-0.02em",
            }}
          >
            {question}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 32 }}>
            {[
              { label: "Yes", pct: yesPct, color: "#10b981" },
              { label: "No", pct: noPct, color: "#71717a" },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  border: "2px solid #e4e4e7",
                  borderRadius: 18,
                  padding: "18px 22px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${row.pct}%`,
                    background: "rgba(16,185,129,0.18)",
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    width: "100%",
                    justifyContent: "space-between",
                    fontSize: 28,
                    fontWeight: 700,
                    color: "#18181b",
                  }}
                >
                  <span>{row.label}</span>
                  <span>{row.pct}%</span>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: "auto",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 18,
              color: "#52525b",
              fontWeight: 600,
            }}
          >
            <span>Settles {formatEndsAtLabel(market.endsAt)}</span>
            <span>peaksees.vercel.app</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
