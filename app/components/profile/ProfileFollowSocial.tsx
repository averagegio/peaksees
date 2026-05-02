"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { safeJson } from "@/lib/http";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function ProfileFollowSocial(props: {
  targetUserId: string;
  /** Logged-in viewer id, or empty when unauthenticated branch never shows button */
  viewerUserId: string;
  /** Show Follow / Following button (others' profiles); own dashboard hides it */
  showFollowButton: boolean;
  initialFollowers: number;
  initialFollowing: number;
  initialIsFollowing: boolean;
}) {
  const router = useRouter();
  const [followers, setFollowers] = useState(props.initialFollowers);
  const [following, setFollowing] = useState(props.initialFollowing);
  const [isFollowingTarget, setIsFollowingTarget] = useState(props.initialIsFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const viewingSelf = props.viewerUserId === props.targetUserId;
  const canToggle =
    props.showFollowButton &&
    !viewingSelf &&
    props.viewerUserId.length > 0;

  async function toggleFollow() {
    if (!canToggle || busy) return;
    setBusy(true);
    setError(null);
    const nextFollow = !isFollowingTarget;
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: props.targetUserId,
          follow: nextFollow,
        }),
      });
      const data =
        (await safeJson<{
          error?: string;
          followersCount?: number;
          isFollowing?: boolean;
        }>(res)) ?? {};
      if (!res.ok) {
        throw new Error(data.error ?? "Could not update follow");
      }
      if (typeof data.followersCount === "number") {
        setFollowers(data.followersCount);
      } else if (nextFollow) {
        setFollowers((c) => c + 1);
      } else {
        setFollowers((c) => Math.max(0, c - 1));
      }
      setIsFollowingTarget(Boolean(data.isFollowing));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-zinc-600 dark:text-zinc-400">
        <span>
          <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatCount(followers)}
          </span>{" "}
          <span>{followers === 1 ? "Follower" : "Followers"}</span>
        </span>
        <span aria-hidden className="text-zinc-300 dark:text-zinc-600">
          ·
        </span>
        <span>
          <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatCount(following)}
          </span>{" "}
          <span>Following</span>
        </span>
        {canToggle ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleFollow()}
            className={
              "ml-auto shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition disabled:opacity-60 " +
              (isFollowingTarget
                ? "border border-zinc-300 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                : "bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500")
            }
          >
            {busy ? "…" : isFollowingTarget ? "Following" : "Follow"}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
