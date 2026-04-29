"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { PEAKFAB_PRINT } from "@/lib/brand";

type AttachKind = "image" | "video" | "gif";

export type AttachedFile = {
  id: string;
  kind: AttachKind;
  file: File;
  previewUrl?: string;
};

export function PeakComposerDock() {
  const [modalOpen, setModalOpen] = useState(false);
  const [text, setText] = useState("");
  const [pollMode, setPollMode] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);

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
    // Wire to API later; console for now
    const payload = {
      text,
      attachments: attachments.map((a) => ({ kind: a.kind, name: a.file.name, size: a.file.size })),
      poll:
        pollMode && pollOptions.filter((x) => x.trim()).length >= 2
          ? pollOptions.filter((x) => x.trim())
          : undefined,
    };
    console.warn("[peaksees compose demo]", payload);
    resetComposer();
    setModalOpen(false);
  }

  const canPost =
    text.trim().length > 0 ||
    attachments.length > 0 ||
    (pollMode && pollOptions.filter((o) => o.trim()).length >= 2);

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
          aria-haspopup="dialog"
          aria-expanded={modalOpen}
          className="peak-fab-trigger relative isolate box-border h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white p-[3px] shadow-md ring-2 ring-emerald-500/30 ring-offset-1 ring-offset-zinc-100 transition active:scale-[0.93] dark:bg-zinc-950 dark:ring-emerald-500/38 dark:ring-offset-zinc-950"
          title="Compose a peak"
          onClick={() => setModalOpen(true)}
        >
          <Image
            src={PEAKFAB_PRINT}
            alt=""
            fill
            sizes="40px"
            className="peak-fab-img object-contain object-center"
            priority
            aria-hidden
          />
          <span className="sr-only">Compose peak</span>
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
                Write a peak
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
                placeholder="What are you predicting?"
                rows={5}
                className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 text-[15px] leading-relaxed text-zinc-900 outline-none ring-emerald-500/20 placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />

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

              <button
                type="button"
                disabled={!canPost}
                className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:disabled:bg-zinc-700"
                onClick={handlePost}
              >
                Post peak
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
