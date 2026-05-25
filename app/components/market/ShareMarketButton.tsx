"use client";

import { toBlob } from "html-to-image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

function xTweetIntentUrl(text: string, url: string) {
  const params = new URLSearchParams();
  if (text.trim()) params.set("text", text.trim());
  if (url.trim()) params.set("url", url.trim());
  const q = params.toString();
  return `https://twitter.com/intent/tweet${q ? `?${q}` : ""}`;
}

function isMobileShareEnv() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
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

function XBrandIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function ShareMarketButton({
  getNode,
  filenameBase,
  marketId,
  question,
}: {
  getNode: () => HTMLElement | null;
  filenameBase: string;
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

  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  const shareUrl = `${appOrigin()}/m/${encodeURIComponent(marketId)}`;
  const tweetText = `${question.trim().slice(0, 220)}${question.trim().length > 220 ? "..." : ""}`;

  const uploadShareImage = useCallback(
    async (blob: Blob) => {
      const res = await fetch(
        `/api/markets/${encodeURIComponent(marketId)}/share-image`,
        {
          method: "POST",
          headers: { "Content-Type": "image/png" },
          body: blob,
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not upload share image");
      }
    },
    [marketId],
  );

  const ensureCapture = useCallback(async () => {
    const cached = captureRef.current;
    if (cached) return cached;

    const node = getNode();
    if (!node) throw new Error("Nothing to capture");

    const exportWidth = Math.min(640, Math.max(360, node.offsetWidth || 640));
    const exportHeight = Math.max(node.offsetHeight, node.scrollHeight);

    const blob = await toBlob(node, {
      cacheBust: true,
      pixelRatio: 2,
      width: exportWidth,
      height: exportHeight,
      backgroundColor: "#ffffff",
      style: {
        width: `${exportWidth}px`,
        maxWidth: `${exportWidth}px`,
        boxSizing: "border-box",
      },
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

      if (dest === "x") {
        const intentUrl = xTweetIntentUrl(tweetText, shareUrl);

        if (isMobileShareEnv()) {
          void ensureCapture()
            .then(({ blob }) => uploadShareImage(blob))
            .catch(() => {});
          window.location.assign(intentUrl);
          setMenuOpen(false);
          return;
        }

        const popup = window.open("about:blank", "_blank");
        try {
          const { blob } = await ensureCapture();
          try {
            await uploadShareImage(blob);
          } catch {
            // Link preview falls back to server-generated image.
          }
        } catch (e) {
          popup?.close();
          throw e;
        }
        if (popup && !popup.closed) {
          popup.location.href = intentUrl;
        } else {
          window.location.assign(intentUrl);
        }
        setHint("Opening X. Your market card should appear as the link preview.");
        setMenuOpen(false);
        return;
      }

      const { blob, file } = await ensureCapture();

      switch (dest) {
        case "linkedin": {
          await triggerDownload(blob, file.name);
          const popup = window.open(
            `https://www.linkedin.com/sharing/share-offsite/?mini=true&url=${encodeURIComponent(shareUrl)}`,
            "_blank",
          );
          if (!popup) window.location.assign(shareUrl);
          setHint("Image downloaded. Add it manually in LinkedIn for a richer post.");
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
              "Image saved. Open Instagram, tap New post, then pick this image from your gallery.",
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
              "Image saved. Open TikTok, tap + then Upload, then select this image from your gallery.",
            );
          }
          setMenuOpen(false);
          break;
        }
        default:
          break;
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
        setHint("Sharing not available. Image downloaded.");
      }
      setMenuOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Share failed");
    } finally {
      setBusy(false);
    }
  }

  const shareModal =
    portalReady && menuOpen
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setMenuOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-market-title"
              className="w-full max-h-[85dvh] max-w-md overflow-hidden rounded-t-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <div className="min-w-0">
                  <p
                    id="share-market-title"
                    className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                  >
                    Share market
                  </p>
                  <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                    Export image and open the app you want
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  aria-label="Close"
                  onClick={() => setMenuOpen(false)}
                >
                  <span aria-hidden className="text-lg leading-none">
                    &times;
                  </span>
                </button>
              </header>

              <div className="max-h-[calc(85dvh-8rem)] overflow-y-auto p-3">
                <p className="mb-3 rounded-xl bg-zinc-50 px-3 py-2 text-[13px] leading-snug text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {tweetText.slice(0, 120)}
                  {tweetText.length > 120 ? "..." : ""}
                </p>

                <div className="flex flex-col gap-1 py-1" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:text-zinc-100 dark:hover:bg-zinc-900"
                    onClick={() => void runDestination("x")}
                  >
                    <span className="flex w-8 shrink-0 items-center justify-center text-zinc-900 dark:text-zinc-100">
                      <XBrandIcon />
                    </span>
                    Post on X
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:text-zinc-100 dark:hover:bg-zinc-900"
                    onClick={() => void runDestination("linkedin")}
                  >
                    <span className="w-8 text-center text-xs font-bold text-[#0A66C2]" aria-hidden>
                      in
                    </span>
                    Share on LinkedIn
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:text-zinc-100 dark:hover:bg-zinc-900"
                    onClick={() => void runDestination("instagram")}
                  >
                    <span className="w-8 text-center text-xs font-bold" aria-hidden>
                      IG
                    </span>
                    Instagram
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:text-zinc-100 dark:hover:bg-zinc-900"
                    onClick={() => void runDestination("tiktok")}
                  >
                    <span className="w-8 text-center text-xs font-bold" aria-hidden>
                      TT
                    </span>
                    TikTok
                  </button>
                </div>

                {systemShareAvailable ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="mt-2 w-full rounded-xl border border-zinc-200 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    onClick={() => void nativeShareOnly()}
                  >
                    System share...
                  </button>
                ) : null}

                {hint ? (
                  <p className="mt-3 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
                    {hint}
                  </p>
                ) : null}
                {error ? (
                  <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="flex flex-col items-start gap-2">
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
          aria-haspopup="dialog"
          aria-label="Share market"
        >
          <span className="h-4 w-4" aria-hidden>
            <ShareIcon />
          </span>
          {busy ? "Working..." : "Share"}
        </button>

        {!menuOpen && hint ? (
          <p className="max-w-[min(100vw-2rem,24rem)] text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
            {hint}
          </p>
        ) : null}
        {!menuOpen && error ? (
          <span className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</span>
        ) : null}
      </div>
      {shareModal}
    </>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path d="M15 8a3 3 0 10-2.83-4H12a3 3 0 003 4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12l-6 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12l6 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 18a3 3 0 100-6 3 3 0 000 6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 18a3 3 0 100-6 3 3 0 000 6z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
