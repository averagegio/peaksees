"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { PEAKFAB_PRINT } from "@/lib/brand";
import { safeJson } from "@/lib/http";
import type { Market } from "@/lib/markets/store";
import type { Peak } from "@/lib/peaks/store";

type AttachKind = "image" | "video" | "gif";

type ComposeUser = {
  id: string;
  displayName: string;
  handle: string;
  avatarHue: number;
};

function hueForUserId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

function toComposeUser(user: {
  id: string;
  email: string;
  displayName: string;
  handle?: string;
  atHandle?: string;
}): ComposeUser {
  const slug =
    typeof user.handle === "string" && user.handle.trim()
      ? user.handle.trim().toLowerCase()
      : (user.email.split("@")[0] ?? "trader").slice(0, 32);
  const at =
    typeof user.atHandle === "string" && user.atHandle.trim()
      ? user.atHandle.trim()
      : `@${slug}`;
  return {
    id: user.id,
    displayName: user.displayName,
    handle: at.startsWith("@") ? at : `@${at}`,
    avatarHue: hueForUserId(user.id),
  };
}

export type AttachedFile = {
  id: string;
  kind: AttachKind;
  file: File;
  previewUrl?: string;
};

export function PeakComposerDock() {
  const [modalOpen, setModalOpen] = useState(false);
  const [text, setText] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [expiresPreset, setExpiresPreset] = useState<
    "never" | "1h" | "6h" | "24h" | "7d" | "30d"
  >("never");
  const [pollMode, setPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [posting, setPosting] = useState(false);
  const [turnIntoMarket, setTurnIntoMarket] = useState(false);
  const [composeUser, setComposeUser] = useState<ComposeUser | null>(null);

  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const gifRef = useRef<HTMLInputElement>(null);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!modalOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setModalOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  useEffect(() => {
    if (!attachMenuOpen) return undefined;
    function outside(e: MouseEvent) {
      if (menuWrapRef.current?.contains(e.target as Node)) return;
      setAttachMenuOpen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [attachMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const data =
          (await safeJson<{
            user?: {
              id: string;
              email: string;
              displayName: string;
              handle?: string;
              atHandle?: string;
            } | null;
          }>(res)) ?? {};
        if (cancelled || !data.user) return;
        setComposeUser(toComposeUser(data.user));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addAttachment = useCallback((kind: AttachKind, file: File | null | undefined) => {
    if (!file || file.size === 0) return;
    const id = crypto.randomUUID();
    let previewUrl: string | undefined;
    if (kind !== "video" && file.type.startsWith("image")) {
      previewUrl = URL.createObjectURL(file);
    }
    setAttachments((prev) => [...prev, { id, kind, file, previewUrl }]);
  }, []);

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const found = prev.find((a) => a.id === id);
      if (found?.previewUrl) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  function resetComposer() {
    setText("");
    setTurnIntoMarket(false);
    setPollMode(false);
    setPollOptions(["", ""]);
    setAttachments((prev) => {
      prev.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
      return [];
    });
  }

  function handlePost() {
    void (async () => {
      const postText = text.trim();
      if (!postText || posting) return;
      if (!composeUser) {
        console.warn("[peaksees compose] not signed in");
        return;
      }

      const clientId = crypto.randomUUID();
      const expiresAt = presetToIso(expiresPreset);
      setPosting(true);

      window.dispatchEvent(
        new CustomEvent("peaksees:peak-pending", {
          detail: {
            clientId,
            text: postText,
            expiresAt,
            createMarket: turnIntoMarket,
            user: composeUser,
          },
        }),
      );
      resetComposer();
      setModalOpen(false);

      try {
        const res = await fetch("/api/peaks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: postText, expiresAt, createMarket: turnIntoMarket }),
        });
        const data = (await safeJson<{ peak?: Peak; market?: Market; error?: string }>(res)) ?? {};
        if (!res.ok) {
          console.warn("[peaksees compose] failed", data.error ?? "error");
          window.dispatchEvent(
            new CustomEvent("peaksees:peak-failed", { detail: { clientId } }),
          );
          return;
        }
        window.dispatchEvent(
          new CustomEvent("peaksees:new-peak", {
            detail: { clientId, peak: data.peak, market: data.market },
          }),
        );
      } catch (e) {
        console.warn("[peaksees compose] failed", e);
        window.dispatchEvent(new CustomEvent("peaksees:peak-failed", { detail: { clientId } }));
      } finally {
        setPosting(false);
      }
    })();
  }

  const canPost = text.trim().length > 0 && !posting && Boolean(composeUser);

  async function suggest() {
    setSuggesting(true);
    setSuggestionError(null);
    try {
      const res = await fetch("/api/peak/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: text.trim().slice(0, 200) }),
      });
      const data =
        (await safeJson<{ suggestion?: string; error?: string }>(res)) ?? {};
      if (!res.ok) {
        setSuggestionError(data.error ?? "Could not get suggestion");
        return;
      }
      if (data.suggestion) {
        setText((prev) => (prev.trim().length === 0 ? data.suggestion! : `${prev.trim()}\n\n${data.suggestion}`));
      }
    } catch {
      setSuggestionError("Could not get suggestion");
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-[45] flex flex-col items-end p-3 sm:p-4">
      <div className="pointer-events-auto group relative flex flex-col items-end">
        {/* Hover popover — desktop only */}
        <div
          className="pointer-events-none absolute bottom-[calc(100%+0.35rem)] right-0 w-[min(calc(100vw-2.5rem),17rem)] translate-y-1 rounded-xl border border-zinc-200/90 bg-white/92 px-3 py-2.5 text-left opacity-0 shadow-lg shadow-black/12 backdrop-blur-md transition-[opacity,transform] duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 max-sm:invisible dark:border-zinc-700 dark:bg-zinc-900/95"
          role="dialog"
          aria-label="Quick compose"
          aria-hidden
        >
          <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-50">
            Write a peak
          </p>
          <p className="mt-1 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
            Attach photos, GIF, video, or a poll.
          </p>
          <button
            type="button"
            className="mt-2.5 flex w-full items-center justify-center rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 sm:text-[13px]"
            onClick={() => {
              setModalOpen(true);
            }}
          >
            Open composer
          </button>
        </div>

        <button
          type="button"
          data-tour="compose-fab"
          aria-haspopup="dialog"
          aria-expanded={modalOpen}
          className="peak-fab-trigger peak-fab-special relative isolate box-border h-14 w-14 shrink-0 overflow-visible rounded-full bg-transparent p-0 shadow-lg shadow-black/20 ring-2 ring-emerald-500/35 ring-offset-2 ring-offset-zinc-100 transition active:scale-[0.93] dark:ring-emerald-400/40 dark:ring-offset-zinc-950"
          title="Compose a peak"
          onClick={() => setModalOpen(true)}
        >
          <Image
            src={PEAKFAB_PRINT}
            alt=""
            width={56}
            height={56}
            className="peak-fab-img h-full w-full object-contain object-center drop-shadow-sm"
            priority
            aria-hidden
          />
          <span className="sr-only">Compose a peak</span>
        </button>
      </div>

      {modalOpen && (
        <div
          className="pointer-events-auto fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            className="flex max-h-[min(92dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-zinc-900 sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="peak-compose-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <h2 id="peak-compose-title" className="text-lg font-semibold text-zinc-900 dark:text-white">
                New post
              </h2>
              <button
                type="button"
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Close"
                onClick={() => setModalOpen(false)}
              >
                ✕
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  turnIntoMarket ? "What are you predicting?" : "What's on your mind?"
                }
                rows={5}
                className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 text-[15px] leading-relaxed text-zinc-900 outline-none ring-emerald-500/20 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={suggest}
                  disabled={suggesting}
                  className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/70"
                >
                  {suggesting ? "Peak is suggesting…" : "Suggest a peak"}
                </button>
                {suggestionError ? (
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                    {suggestionError}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Set time
                  <select
                    value={expiresPreset}
                    onChange={(e) =>
                      setExpiresPreset(
                        (e.target.value as typeof expiresPreset) ?? "never",
                      )
                    }
                    className="ml-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    <option value="never">Never</option>
                    <option value="1h">1 hour</option>
                    <option value="6h">6 hours</option>
                    <option value="24h">24 hours</option>
                    <option value="7d">7 days</option>
                    <option value="30d">30 days</option>
                  </select>
                </label>
              </div>

              {pollMode && (
                <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                    Poll
                  </p>
                  <div className="mt-3 space-y-2">
                    {pollOptions.map((opt, idx) => (
                      <input
                        key={`poll-slot-${idx}`}
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const v = [...pollOptions];
                          v[idx] = e.target.value;
                          setPollOptions(v);
                        }}
                        placeholder={idx === 0 ? "Option 1" : idx === 1 ? "Option 2" : `Option ${idx + 1}`}
                        className="block w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                    ))}
                  </div>
                  {pollOptions.length < 4 && (
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                      onClick={() => setPollOptions((o) => [...o, ""])}
                    >
                      + Add choice
                    </button>
                  )}
                </div>
              )}

              {attachments.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2" aria-live="polite">
                  {attachments.map((a) => (
                    <li key={a.id} className="relative">
                      {a.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- blob previews
                        <img
                          src={a.previewUrl}
                          alt=""
                          className="h-20 w-20 rounded-lg border border-zinc-200 object-cover dark:border-zinc-600"
                        />
                      ) : (
                        <span className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-[10px] font-medium text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {a.kind === "video" ? "Video" : a.file.name.slice(0, 12)}
                        </span>
                      )}
                      <button
                        type="button"
                        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white shadow dark:bg-zinc-100 dark:text-zinc-900"
                        aria-label="Remove attachment"
                        onClick={() => removeAttachment(a.id)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="border-t border-zinc-100 p-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative" ref={menuWrapRef}>
                  <button
                    type="button"
                    aria-expanded={attachMenuOpen}
                    aria-haspopup="true"
                    className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    onClick={() => setAttachMenuOpen((x) => !x)}
                  >
                    Attach
                    <span aria-hidden>{attachMenuOpen ? "▴" : "▾"}</span>
                  </button>
                  {attachMenuOpen && (
                    <ul
                      className="absolute bottom-full left-0 z-[70] mb-1 min-w-[11rem] overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
                      role="menu"
                    >
                      <li role="presentation">
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            imageRef.current?.click();
                          }}
                        >
                          Photos
                        </button>
                      </li>
                      <li role="presentation">
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            gifRef.current?.click();
                          }}
                        >
                          GIF
                        </button>
                      </li>
                      <li role="presentation">
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            videoRef.current?.click();
                          }}
                        >
                          Video
                        </button>
                      </li>
                      <li role="presentation">
                        <button
                          type="button"
                          role="menuitem"
                          className="block w-full border-t border-zinc-100 px-4 py-2.5 text-left text-sm font-medium text-emerald-800 hover:bg-emerald-50 dark:border-zinc-700 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                          onClick={() => {
                            setAttachMenuOpen(false);
                            setPollMode(true);
                          }}
                        >
                          Poll
                        </button>
                      </li>
                    </ul>
                  )}
                </div>

                <input
                  ref={imageRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    [...(e.target.files ?? [])].forEach((f) =>
                      addAttachment("image", f),
                    );
                    e.target.value = "";
                  }}
                />
                <input
                  ref={gifRef}
                  type="file"
                  accept=".gif,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    [...(e.target.files ?? [])].forEach((f) =>
                      addAttachment("gif", f),
                    );
                    e.target.value = "";
                  }}
                />
                <input
                  ref={videoRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    [...(e.target.files ?? [])].forEach((f) =>
                      addAttachment("video", f),
                    );
                    e.target.value = "";
                  }}
                />

                {!pollMode && (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    JPG / PNG · GIF · MP4+
                  </span>
                )}
                {pollMode && (
                  <button
                    type="button"
                    className="ml-auto text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                    onClick={() => setPollMode(false)}
                  >
                    Remove poll
                  </button>
                )}
              </div>

              <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    List as market
                  </span>
                  <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                    Off = social post only · On = Yes/No market card in the feed
                  </span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-checked={turnIntoMarket}
                  checked={turnIntoMarket}
                  onChange={(e) => setTurnIntoMarket(e.target.checked)}
                  className="h-5 w-9 shrink-0 cursor-pointer accent-emerald-600"
                />
              </label>

              <button
                type="button"
                disabled={!canPost}
                className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
                onClick={handlePost}
              >
                {turnIntoMarket ? "Post market" : "Post"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function presetToIso(
  preset: "never" | "1h" | "6h" | "24h" | "7d" | "30d",
): string | null {
  if (preset === "never") return null;
  const now = Date.now();
  const ms =
    preset === "1h"
      ? 60 * 60 * 1000
      : preset === "6h"
        ? 6 * 60 * 60 * 1000
        : preset === "24h"
          ? 24 * 60 * 60 * 1000
          : preset === "7d"
            ? 7 * 24 * 60 * 60 * 1000
            : 30 * 24 * 60 * 60 * 1000;
  return new Date(now + ms).toISOString();
}
