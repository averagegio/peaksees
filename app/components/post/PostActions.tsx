"use client";

import { useEffect, useState } from "react";
import { CommentsDrawer } from "@/app/components/comments/CommentsDrawer";
import { safeJson } from "@/lib/http";

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a8 8 0 01-8 8H7l-4 3V12a8 8 0 018-8h2a8 8 0 018 8z"
      />
    </svg>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 3l7 7-2 2-3-3-4 4v5l-2 2-2-2v-5l4-4-3-3 2-2z"
      />
    </svg>
  );
}

export function PostActions({
  postKey,
  title,
}: {
  postKey: string;
  title: string;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPins() {
      try {
        const res = await fetch("/api/pins", { cache: "no-store" });
        const data = (await safeJson<{ pins?: string[] }>(res)) ?? {};
        if (!cancelled && Array.isArray(data.pins)) {
          setPinned(data.pins.includes(postKey));
        }
      } catch {
        // ignore
      }
    }
    void loadPins();
    return () => {
      cancelled = true;
    };
  }, [postKey]);

  async function togglePin() {
    const res = await fetch("/api/pins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postKey }),
    });
    const data = (await safeJson<{ pinned?: boolean }>(res)) ?? {};
    if (typeof data.pinned === "boolean") setPinned(data.pinned);
  }

  return (
    <>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          data-sparkle-click="true"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          onClick={() => setCommentsOpen(true)}
          aria-label="Open comments"
        >
          <span className="h-4 w-4">
            <CommentIcon />
          </span>
          Comments
        </button>
        <button
          type="button"
          data-sparkle-click="true"
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            pinned
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
          onClick={togglePin}
          aria-label="Pin post"
        >
          <span className="h-4 w-4">
            <PinIcon filled={pinned} />
          </span>
          {pinned ? "Pinned" : "Pin"}
        </button>
      </div>

      <CommentsDrawer
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        postKey={postKey}
        title={title}
      />
    </>
  );
}

