"use client";

import { useEffect, useMemo, useState } from "react";

import { safeJson } from "@/lib/http";
import { ProfileLink } from "@/app/components/profile/ProfileLink";

type Comment = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  text: string;
  createdAt: string;
  upvotes: number;
  viewerUpvoted: boolean;
};

export function CommentsDrawer({
  open,
  onClose,
  postKey,
  title,
}: {
  open: boolean;
  onClose: () => void;
  postKey: string;
  title: string;
}) {
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => text.trim().length > 0, [text]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/comments?postKey=${encodeURIComponent(postKey)}`, {
          cache: "no-store",
        });
        const data =
          (await safeJson<{ comments?: Comment[]; error?: string }>(res)) ?? {};
        if (!res.ok) throw new Error(data.error ?? "Failed to load comments");
        if (!cancelled && Array.isArray(data.comments)) setComments(data.comments);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load comments");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, postKey]);

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    const t = text.trim();
    setText("");
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postKey, text: t }),
    });
    const data = (await safeJson<{ error?: string }>(res)) ?? {};
    if (!res.ok) {
      setError(data.error ?? "Failed to post comment");
      return;
    }

    if (/\B@peak\b/i.test(t)) {
      try {
        const peakRes = await fetch("/api/peak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postKey, text: t, query: title }),
        });
        const peakData = (await safeJson<{ reply?: string }>(peakRes)) ?? {};
        if (peakRes.ok && peakData.reply) {
          await fetch("/api/comments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postKey, text: `Peak: ${peakData.reply}` }),
          });
        }
      } catch {
        // ignore
      }
    }
    // reload to pick up computed upvotes/viewer flags
    const reload = await fetch(`/api/comments?postKey=${encodeURIComponent(postKey)}`, {
      cache: "no-store",
    });
    const reloadData = (await safeJson<{ comments?: Comment[] }>(reload)) ?? {};
    if (Array.isArray(reloadData.comments)) setComments(reloadData.comments);
  }

  async function upvote(commentId: string) {
    await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upvote", commentId }),
    });
    const reload = await fetch(`/api/comments?postKey=${encodeURIComponent(postKey)}`, {
      cache: "no-store",
    });
    const reloadData = (await safeJson<{ comments?: Comment[] }>(reload)) ?? {};
    if (Array.isArray(reloadData.comments)) setComments(reloadData.comments);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center"
      role="presentation"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div
        className="w-full max-w-xl rounded-t-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Comments"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Comments
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{title}</p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </header>

        <div className="max-h-[60dvh] overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
          ) : null}
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}

          {comments.length === 0 && !loading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Be the first to comment.
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <ProfileLink
                        href={`/u/${encodeURIComponent(c.userId)}`}
                        className="group shrink-0"
                        ariaLabel={`Open ${c.displayName} profile`}
                      >
                        {c.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- data URL avatar
                          <img
                            src={c.avatarUrl}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover transition group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700 transition group-hover:scale-[1.03] dark:bg-zinc-800 dark:text-zinc-200">
                            {c.displayName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </ProfileLink>
                      <div className="min-w-0">
                        <ProfileLink
                          href={`/u/${encodeURIComponent(c.userId)}`}
                          className="truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
                        >
                          {c.displayName}
                        </ProfileLink>
                        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                          {c.text}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        c.viewerUpvoted
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      }`}
                      onClick={() => upvote(c.id)}
                      aria-label="Upvote comment"
                    >
                      ▲ {c.upvotes}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-zinc-100 p-4 dark:border-zinc-800">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a comment… (try @peak)"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              type="button"
              disabled={!canSubmit}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              onClick={submit}
            >
              Post
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

