"use client";

import { useEffect, useState } from "react";

import { MarketPostCard } from "@/app/components/PeakFeed";
import { PostActions } from "@/app/components/post/PostActions";
import { ProfileLink } from "@/app/components/profile/ProfileLink";
import {
  buildOptimisticMarket,
  buildOptimisticPeak,
  dropPendingProfileFeedItem,
  marketAndPeakToPost,
  prependProfileFeedItem,
  replacePendingProfileFeedItem,
  type ProfilePeakFeedItem,
} from "@/app/lib/peak-market";
import type { Market } from "@/lib/markets/store";
import type { Peak } from "@/lib/peaks/store";

function PlainPeakCard({ peak }: { peak: Peak }) {
  return (
    <article
      data-peak-id={peak.id}
      className="rounded-2xl border border-zinc-200/90 bg-white/[0.97] p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/95"
    >
      <div className="flex items-center justify-between gap-2">
        <ProfileLink
          href={`/u/${encodeURIComponent(peak.userId)}`}
          className="font-semibold hover:underline"
        >
          {peak.displayName}
        </ProfileLink>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {new Date(peak.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-snug text-zinc-800 dark:text-zinc-100">
        {peak.text}
      </p>
      {peak.expiresAt ? (
        <p className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Expires {new Date(peak.expiresAt).toLocaleString()}
        </p>
      ) : null}
      <PostActions postKey={`peak:${peak.id}`} title={peak.text} />
    </article>
  );
}

export function ProfilePeakFeed({
  profileUserId,
  initialItems,
  isOwnProfile = false,
}: {
  profileUserId: string;
  initialItems: ProfilePeakFeedItem[];
  isOwnProfile?: boolean;
}) {
  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    if (!isOwnProfile) return undefined;

    function onPeakPending(e: Event) {
      const detail = (e as CustomEvent).detail as
        | {
            clientId?: string;
            text?: string;
            expiresAt?: string | null;
            user?: { id: string; displayName: string; handle: string; avatarHue: number };
          }
        | undefined;
      const clientId = detail?.clientId?.trim();
      const text = typeof detail?.text === "string" ? detail.text.trim() : "";
      const user = detail?.user;
      if (!clientId || !text || !user || user.id !== profileUserId) return;

      const peak = buildOptimisticPeak(clientId, {
        text,
        expiresAt: detail?.expiresAt,
        userId: user.id,
        displayName: user.displayName,
        handle: user.handle,
        avatarHue: user.avatarHue,
      });
      const market = buildOptimisticMarket(clientId, text);
      setItems((prev) => prependProfileFeedItem(prev, { peak, market }));
    }

    function onNewPeak(e: Event) {
      const detail = (e as CustomEvent).detail as
        | { clientId?: string; peak?: Peak; market?: Market }
        | undefined;
      const clientId = detail?.clientId?.trim();
      const peak = detail?.peak;
      const market = detail?.market;
      if (!peak || peak.userId !== profileUserId) return;

      setItems((prev) => {
        const nextItem: ProfilePeakFeedItem = { peak, market: market ?? null };
        if (clientId) return replacePendingProfileFeedItem(prev, clientId, nextItem);
        return prependProfileFeedItem(prev, nextItem);
      });
    }

    function onPeakFailed(e: Event) {
      const clientId = ((e as CustomEvent).detail as { clientId?: string } | undefined)?.clientId?.trim();
      if (!clientId) return;
      setItems((prev) => dropPendingProfileFeedItem(prev, clientId));
    }

    window.addEventListener("peaksees:peak-pending", onPeakPending as EventListener);
    window.addEventListener("peaksees:new-peak", onNewPeak as EventListener);
    window.addEventListener("peaksees:peak-failed", onPeakFailed as EventListener);
    return () => {
      window.removeEventListener("peaksees:peak-pending", onPeakPending as EventListener);
      window.removeEventListener("peaksees:new-peak", onNewPeak as EventListener);
      window.removeEventListener("peaksees:peak-failed", onPeakFailed as EventListener);
    };
  }, [isOwnProfile, profileUserId]);

  if (items.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-300">No peaks yet.</p>;
  }

  return (
    <ul className="space-y-5">
      {items.map(({ peak, market }) => (
        <li key={peak.id}>
          {market ? (
            <MarketPostCard post={marketAndPeakToPost(market, peak)} />
          ) : (
            <PlainPeakCard peak={peak} />
          )}
        </li>
      ))}
    </ul>
  );
}
