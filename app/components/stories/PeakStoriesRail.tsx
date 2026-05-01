"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Story = {
  id: string;
  title: string;
  src: string;
};

const DEMO_STORIES: Story[] = [
  {
    id: "s1",
    title: "Peak story",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  },
  {
    id: "s2",
    title: "Trending clip",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4#t=0.1",
  },
  {
    id: "s3",
    title: "Live moment",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4#t=0.2",
  },
];

export function PeakStoriesRail() {
  const stories = useMemo(() => DEMO_STORIES, []);
  const [openId, setOpenId] = useState<string | null>(null);
  const openStory = stories.find((s) => s.id === openId) ?? null;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const modal =
    openStory && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-3"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpenId(null);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Peak story"
              className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-3 top-3 z-10 rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/55"
                onClick={() => setOpenId(null)}
                aria-label="Close"
              >
                Close
              </button>
              <video
                ref={videoRef}
                src={openStory.src}
                controls
                playsInline
                autoPlay
                className="h-[70dvh] w-full bg-black object-contain"
              />
              <div className="border-t border-white/10 p-3">
                <p className="text-sm font-semibold text-white">{openStory.title}</p>
                <p className="mt-1 text-xs text-white/70">
                  Peak Stories are video-only. (Demo clips for now.)
                </p>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <section className="rounded-2xl border border-zinc-200/90 bg-white/[0.97] p-3 shadow-sm backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Peak Stories
          </p>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            Video
          </span>
        </div>

        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Quick clips that don’t interrupt your feed.
        </p>

        <ul className="mt-3 space-y-2">
          {stories.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setOpenId(s.id)}
                className="group flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-left transition hover:bg-white dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-black">
                  <video
                    src={s.src}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-white">
                      ▶
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {s.title}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Tap to watch
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {modal}
    </>
  );
}

