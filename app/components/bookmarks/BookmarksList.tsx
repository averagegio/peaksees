"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { MarketPostCard } from "@/app/components/PeakFeed";
import { SocialPostCard } from "@/app/components/profile/SocialPostCard";
import { marketAndPeakToPost } from "@/app/lib/peak-market";
import type { BookmarkRow } from "@/lib/social/bookmarks-feed";
import { usePostPin } from "@/app/hooks/usePostPin";

function SavedAtLabel({ iso }: { iso: string }) {
  let label = "Saved";
  try {
    label = `Saved ${new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(new Date(iso))}`;
  } catch {
    // keep default
  }
  return (
    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
      {label}
    </p>
  );
}

function BookmarkRemoveButton({ postKey }: { postKey: string }) {
  const { pinned, toggle, pinning } = usePostPin(postKey);
  if (!pinned) return null;
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={pinning}
      className="text-[11px] font-semibold text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
    >
      Remove
    </button>
  );
}

export function BookmarksList({
  initialRows,
  viewerUserId,
}: {
  initialRows: BookmarkRow[];
  viewerUserId: string;
}) {
  const [rows, setRows] = useState(initialRows);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const onPinSync = useCallback((e: Event) => {
    const detail = (e as CustomEvent<{ postKey: string; pinned: boolean }>).detail;
    if (!detail?.postKey) return;
    if (detail.pinned) return;
    setRows((prev) => prev.filter((r) => r.postKey !== detail.postKey));
  }, []);

  useEffect(() => {
    window.addEventListener("peaksees:pins-updated", onPinSync as EventListener);
    return () => window.removeEventListener("peaksees:pins-updated", onPinSync as EventListener);
  }, [onPinSync]);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/80">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Bookmarks</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Tap the ribbon on a market card or use Repeak on a peak to save it here.
        </p>
        <Link
          href="/feed"
          className="mt-6 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Browse feed
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Bookmarks</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {rows.length} saved {rows.length === 1 ? "item" : "items"}
      </p>
      <ul className="mt-6 space-y-6">
        {rows.map((row) => (
          <li key={row.postKey}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <SavedAtLabel iso={row.savedAt} />
              <BookmarkRemoveButton postKey={row.postKey} />
            </div>
            {row.type === "market" ? (
              <MarketPostCard post={row.post} viewerUserId={viewerUserId} />
            ) : row.market ? (
              <MarketPostCard
                post={marketAndPeakToPost(row.market, row.peak)}
                viewerUserId={viewerUserId}
              />
            ) : (
              <SocialPostCard peak={row.peak} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
