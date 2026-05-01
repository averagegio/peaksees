"use client";

import { toBlob } from "html-to-image";
import { useCallback, useEffect, useRef, useState } from "react";

type NavWithShare = Navigator & {
  share?: (data: {
    title?: string;
    text?: string;
    url?: string;
    files?: File[];
  }) => Promise<void>;
  canShare?: (data: { files?: File[] }) => boolean;
};

function appOrigin(): string {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function slugFilename(base: string) {
  return base
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 48);
}

function openWindowSafe(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

async function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function shareNativeFiles(nav: NavWithShare, file: File, text: string) {
  if (!nav.share || (nav.canShare && !nav.canShare({ files: [file] }))) return false;
  await nav.share({ title: "peaksees", text, files: [file] });
  return true;
}

export function ShareMarketButton({
  getNode,
  filenameBase,
  marketId,
  question,
}: {
  getNode: () => HTMLElement | null;
  filenameBase: string;
  /** Used for stable share URLs (feed deep link). */
  marketId: string;
  question: string;
}) {
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const captureRef = useRef<{ blob: Blob; file: File } | null>(null);
  const [systemShareAvailable, setSystemShareAvailable] = useState(false);

  useEffect(() => {
    const nav =
      typeof navigator !== "undefined" ? (navigator as NavWithShare) : undefined;
    setSystemShareAvailable(Boolean(nav?.share));
  }, []);

  const shareUrl = `${appOrigin()}/feed?m=${encodeURIComponent(marketId)}`;
  const tweetText = `${question.trim().slice(0, 220)}${question.trim().length > 220 ? "…" : ""}`;

  const ensureCapture = useCallback(async () => {
    const cached = captureRef.current;
    if (cached) return cached;

    const node = getNode();
    if (!node) throw new Error("Nothing to capture");

    const blob = await toBlob(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });
    if (!blob) throw new Error("Image export failed");

    const name = `${slugFilename(filenameBase) || "market"}.png`;
    const file = new File([blob], name, { type: "image/png" });
    captureRef.current = { blob, file };
    return captureRef.current;
  }, [filenameBase, getNode]);

  const runDestination = async (dest: "x" | "linkedin" | "instagram" | "tiktok") => {
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const nav = navigator as NavWithShare;
      const { blob, file } = await ensureCapture();

      switch (dest) {
        case "x": {
          await triggerDownload(blob, file.name);
          openWindowSafe(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`,
          );
          setHint("Image downloaded — attach it in X if you want the card in the tweet.");
          setMenuOpen(false);
          break;
        }
        case "linkedin": {
          await triggerDownload(blob, file.name);
          openWindowSafe(
            `https://www.linkedin.com/sharing/share-offsite/?mini=true&url=${encodeURIComponent(shareUrl)}`,
          );
          setHint("Image downloaded — add it manually in LinkedIn for a richer post.");
          setMenuOpen(false);
          break;
        }
        case "instagram": {
          const ok = await shareNativeFiles(
            nav,
            file,
            `${tweetText} ${shareUrl}`.trim(),
          );
          if (!ok) {
            await triggerDownload(blob, file.name);
            setHint(
              "Image saved — open Instagram, tap New post, then pick this image from your gallery.",
            );
          }
          setMenuOpen(false);
          break;
        }
        case "tiktok": {
          const ok = await shareNativeFiles(nav, file, `${tweetText} ${shareUrl}`.trim());
          if (!ok) {
            await triggerDownload(blob, file.name);
            setHint(
              "Image saved — open TikTok, tap + → Upload, then select this image from your gallery.",
            );
          }
          setMenuOpen(false);
          break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Share failed");
    } finally {
      setBusy(false);
    }
  };

  async function nativeShareOnly() {
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const { blob, file } = await ensureCapture();
      const nav = navigator as NavWithShare;
      const ok = await shareNativeFiles(nav, file, `${tweetText}\n${shareUrl}`);
      if (!ok) {
        await triggerDownload(blob, file.name);
        setHint("Sharing not available — image downloaded.");
      }
      setMenuOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setMenuOpen((o) => !o);
            setHint(null);
            setError(null);
          }}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label="Share market"
        >
          <span className="h-4 w-4" aria-hidden>
            <ShareIcon />
          </span>
          {busy ? "Working…" : "Share"}
        </button>

        {systemShareAvailable ? (
          <button
            type="button"
            onClick={() => void nativeShareOnly()}
            disabled={busy || menuOpen}
            className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            System share…
          </button>
        ) : null}
      </div>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 min-w-[220px] overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-950"
        >
          <p className="border-b border-zinc-100 px-3 py-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Pick an app · image is exported for you
          </p>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:text-zinc-100 dark:hover:bg-zinc-900"
            onClick={() => void runDestination("x")}
          >
            <span aria-hidden>X</span> Post on X / Twitter
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:text-zinc-100 dark:hover:bg-zinc-900"
            onClick={() => void runDestination("linkedin")}
          >
            <span aria-hidden>in</span> Share on LinkedIn
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:text-zinc-100 dark:hover:bg-zinc-900"
            onClick={() => void runDestination("instagram")}
          >
            <span aria-hidden>IG</span> Instagram
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:text-zinc-100 dark:hover:bg-zinc-900"
            onClick={() => void runDestination("tiktok")}
          >
            <span aria-hidden>TT</span> TikTok
          </button>
        </div>
      ) : null}

      {hint ? (
        <p className="max-w-[min(100vw-2rem,24rem)] text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
      {error ? (
        <span className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</span>
      ) : null}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M15 8a3 3 0 10-2.83-4H12a3 3 0 003 4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12l-6 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12l6 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 18a3 3 0 100-6 3 3 0 000 6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 18a3 3 0 100-6 3 3 0 000 6z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
