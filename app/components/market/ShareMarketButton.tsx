"use client";

import { toBlob } from "html-to-image";
import { useState } from "react";

export function ShareMarketButton({
  getNode,
  filenameBase,
}: {
  getNode: () => HTMLElement | null;
  filenameBase: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    const node = getNode();
    if (!node) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await toBlob(node, {
        cacheBust: true,
        pixelRatio: 2,
        // Keep a clean exported image even with gradients/shadows.
        backgroundColor: "#ffffff",
      });
      if (!blob) throw new Error("Image export failed");

      const safe = filenameBase
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-_]/g, "")
        .slice(0, 48);
      const file = new File([blob], `${safe || "market"}.png`, { type: "image/png" });

      const nav = navigator as Navigator & {
        share?: (data: {
          title?: string;
          text?: string;
          url?: string;
          files?: File[];
        }) => Promise<void>;
        canShare?: (data: { files?: File[] }) => boolean;
      };
      if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await nav.share({
          title: "peaksees",
          text: "Check this market on peaksees",
          files: [file],
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void share()}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
        aria-label="Share market"
      >
        <span className="h-4 w-4" aria-hidden>
          <ShareIcon />
        </span>
        {busy ? "Exporting…" : "Share"}
      </button>
      {error ? (
        <span className="text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        d="M15 8a3 3 0 10-2.83-4H12a3 3 0 003 4z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12l-6 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12l6 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 18a3 3 0 100-6 3 3 0 000 6z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 18a3 3 0 100-6 3 3 0 000 6z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

