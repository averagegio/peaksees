"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { safeJson } from "@/lib/http";

export function FollowUserButton({
  targetUserId,
  viewerUserId,
  initialIsFollowing,
  className = "",
  size = "default",
}: {
  targetUserId: string;
  viewerUserId: string;
  initialIsFollowing?: boolean;
  className?: string;
  size?: "default" | "compact";
}) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(Boolean(initialIsFollowing));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(typeof initialIsFollowing === "boolean");

  const viewingSelf = viewerUserId === targetUserId;
  const canShow = !viewingSelf && viewerUserId.length > 0 && targetUserId.length > 0;

  useEffect(() => {
    if (!canShow || typeof initialIsFollowing === "boolean") {
      setReady(true);
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/follow?userId=${encodeURIComponent(targetUserId)}`,
          { cache: "no-store" },
        );
        const data =
          (await safeJson<{ isFollowing?: boolean }>(res)) ?? {};
        if (!cancelled && res.ok) {
          setIsFollowing(Boolean(data.isFollowing));
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canShow, targetUserId, initialIsFollowing]);

  if (!canShow) return null;

  async function toggleFollow() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const nextFollow = !isFollowing;
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId, follow: nextFollow }),
      });
      const data =
        (await safeJson<{ error?: string; isFollowing?: boolean }>(res)) ?? {};
      if (!res.ok) {
        throw new Error(data.error ?? "Could not update follow");
      }
      setIsFollowing(Boolean(data.isFollowing));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const sizeClass =
    size === "compact"
      ? "px-3 py-1 text-[11px]"
      : "min-w-[7.5rem] px-5 py-2 text-sm";

  return (
    <div className={className}>
      <button
        type="button"
        disabled={busy || !ready}
        onClick={() => void toggleFollow()}
        className={
          "rounded-full font-bold transition disabled:opacity-60 " +
          sizeClass +
          " " +
          (isFollowing
            ? "border border-zinc-300 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            : "bg-emerald-600 text-white hover:bg-emerald-500")
        }
      >
        {!ready ? "…" : busy ? "…" : isFollowing ? "Following" : "Follow"}
      </button>
      {error ? (
        <p className="mt-1 text-[11px] font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
