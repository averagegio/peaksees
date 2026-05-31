"use client";

import { useState } from "react";

import { safeJson } from "@/lib/http";

function marketEmbedPath(marketId: string, mode: "overlay" | "panel") {
  const base = `/embed/market/${encodeURIComponent(marketId)}`;
  return mode === "overlay" ? `${base}?mode=overlay&transparent=1` : `${base}?mode=panel`;
}

function absoluteUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (typeof window === "undefined") return pathOrUrl;
  return new URL(pathOrUrl, window.location.origin).href;
}

export function TwitchStreamSetup({ marketId }: { marketId: string }) {
  const [channel, setChannel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null);
  const [panelUrl, setPanelUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function pinAndShowUrls() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/twitch/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelLogin: channel, marketId }),
      });
      const data =
        (await safeJson<{
          error?: string;
          widget?: { links?: { overlayEmbedUrl?: string; panelEmbedUrl?: string } };
        }>(res)) ?? {};
      if (!res.ok) {
        setError(data.error ?? "Could not pin market");
        return;
      }
      setOverlayUrl(data.widget?.links?.overlayEmbedUrl ?? null);
      setPanelUrl(data.widget?.links?.panelEmbedUrl ?? null);
    } catch {
      setError("Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(absoluteUrl(text));
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Copy failed");
    }
  }

  const previewOverlay = overlayUrl ?? marketEmbedPath(marketId, "overlay");
  const previewPanel = panelUrl ?? marketEmbedPath(marketId, "panel");

  return (
    <div className="mt-3 rounded-xl border border-[#9146FF]/35 bg-[#9146FF]/[0.06] p-3 dark:bg-[#9146FF]/10">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#9146FF]">
        Twitch live widget
      </p>
      <p className="mt-1 text-[12px] text-zinc-600 dark:text-zinc-400">
        Pin this market to your channel, then add the overlay URL as an OBS Browser Source (1920×120).
        Viewers bet via the panel link or peaksees on their phone.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="text"
          value={channel}
          onChange={(e) => setChannel(e.target.value.replace(/^@/, ""))}
          placeholder="your_twitch_login"
          className="min-w-[140px] flex-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950"
        />
        <button
          type="button"
          disabled={busy || channel.trim().length < 3}
          onClick={() => void pinAndShowUrls()}
          className="rounded-lg bg-[#9146FF] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Pinning…" : "Pin to channel"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="mt-3 space-y-2">
        <div>
          <p className="text-[11px] font-semibold text-zinc-500">OBS overlay (transparent)</p>
          <button
            type="button"
            onClick={() => void copyText("overlay", previewOverlay)}
            className="mt-0.5 w-full truncate rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-left text-[11px] text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {copied === "overlay" ? "Copied!" : previewOverlay}
          </button>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-zinc-500">Viewer panel (bet on phone)</p>
          <button
            type="button"
            onClick={() => void copyText("panel", previewPanel)}
            className="mt-0.5 w-full truncate rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-left text-[11px] text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
          >
            {copied === "panel" ? "Copied!" : previewPanel}
          </button>
        </div>
      </div>
    </div>
  );
}
