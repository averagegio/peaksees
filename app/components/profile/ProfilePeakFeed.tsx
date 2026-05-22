"use client";

import { useEffect, useState } from "react";

import { MarketPostCard } from "@/app/components/PeakFeed";
import { SocialPostCard } from "@/app/components/profile/SocialPostCard";
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

export function ProfilePeakFeed({
  profileUserId,
  initialItems,
  isOwnProfile = false,
  emptyMessage = "Nothing here yet.",
  viewerUserId,
}: {
  profileUserId: string;
  initialItems: ProfilePeakFeedItem[];
  isOwnProfile?: boolean;
  emptyMessage?: string;
  viewerUserId?: string;
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
            createMarket?: boolean;
            user?: { id: string; displayName: string; handle: string; avatarHue: number };
          }
        | undefined;
      const clientId = detail?.clientId?.trim();
      const text = typeof detail?.text === "string" ? detail.text.trim() : "";
      const user = detail?.user;
      const createMarket = Boolean(detail?.createMarket);
      if (!clientId || !text || !user || user.id !== profileUserId) return;

      const peak = buildOptimisticPeak(clientId, {
        text,
        expiresAt: detail?.expiresAt,
        userId: user.id,
        displayName: user.displayName,
        handle: user.handle,
        avatarHue: user.avatarHue,
      });
      const market = createMarket ? buildOptimisticMarket(clientId, text) : null;
      setItems((prev) => prependProfileFeedItem(prev, { peak, market, isRepeak: false }));
    }

    function onNewPeak(e: Event) {
      const detail = (e as CustomEvent).detail as
        | { clientId?: string; peak?: Peak; market?: Market | null }
        | undefined;
      const clientId = detail?.clientId?.trim();
      const peak = detail?.peak;
      const market = detail?.market ?? null;
      if (!peak || peak.userId !== profileUserId) return;

      setItems((prev) => {
        const nextItem: ProfilePeakFeedItem = { peak, market, isRepeak: false };
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
    return <p className="text-sm text-zinc-600 dark:text-zinc-300">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-5">
      {items.map(({ peak, market, repeakedAt, isRepeak }) => (
        <li key={peak.id}>
          {market ? (
            <MarketPostCard
              post={marketAndPeakToPost(market, peak)}
              viewerUserId={viewerUserId}
            />
          ) : (
            <SocialPostCard peak={peak} repeakedAt={repeakedAt} isRepeak={isRepeak} />
          )}
        </li>
      ))}
    </ul>
  );
}
