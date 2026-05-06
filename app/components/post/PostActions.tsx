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

/** Re-peak / repost affordance (same backend as saved “pins”). */
function RepeakIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
      className={active ? "text-emerald-700 dark:text-emerald-400" : undefined}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 17l-3 3 3 3M17 7l3-3-3-3M4 17h11a4 4 0 004-4M20 7H9a4 4 0 00-4 4"
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
  const [repeaked, setRepeaked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPins() {
      try {
        const res = await fetch("/api/pins", { cache: "no-store" });
        const data = (await safeJson<{ pins?: string[] }>(res)) ?? {};
        if (!cancelled && Array.isArray(data.pins)) {
          setRepeaked(data.pins.includes(postKey));
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

  async function toggleRepeak() {
    const res = await fetch("/api/pins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postKey }),
    });
    const data = (await safeJson<{ pinned?: boolean }>(res)) ?? {};
    if (typeof data.pinned === "boolean") setRepeaked(data.pinned);
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
            repeaked
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          }`}
          onClick={toggleRepeak}
          title={
            repeaked ? "Undo repeak" : "Repeak — save this post on your feed (yours or others)"
          }
          aria-label={repeaked ? "Undo repeak for this post" : "Repeak this post"}
        >
          <span className="h-4 w-4">
            <RepeakIcon active={repeaked} />
          </span>
          {repeaked ? "Repeaked" : "Repeak"}
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

