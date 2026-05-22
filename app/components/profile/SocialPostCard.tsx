"use client";

import { PostActions } from "@/app/components/post/PostActions";
import { ProfileLink } from "@/app/components/profile/ProfileLink";
import { formatMarketPostedAt } from "@/app/lib/peak-market";
import type { Peak } from "@/lib/peaks/store";

export function SocialPostCard({
  peak,
  repeakedAt,
  isRepeak = false,
}: {
  peak: Peak;
  repeakedAt?: string | null;
  isRepeak?: boolean;
}) {
  const profileHref = `/u/${encodeURIComponent(peak.userId)}`;
  const when = formatMarketPostedAt(peak.createdAt);

  return (
    <article
      data-peak-id={peak.id}
      className="rounded-2xl border border-zinc-200/90 bg-white/[0.97] p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/95"
    >
      <header className="flex items-start gap-3">
        <ProfileLink href={profileHref} className="group shrink-0">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white ring-2 ring-white/30 dark:ring-zinc-700"
            style={{ backgroundColor: `hsl(${peak.avatarHue} 55% 42%)` }}
            aria-hidden
          >
            {peak.displayName
              .split(" ")
              .map((w) => w[0])
              .join("")}
          </div>
        </ProfileLink>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <ProfileLink
              href={profileHref}
              className="truncate font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
            >
              {peak.displayName}
            </ProfileLink>
            <ProfileLink
              href={profileHref}
              className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
            >
              {peak.handle}
            </ProfileLink>
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{when}</span>
          </div>
          {isRepeak ? (
            <p className="mt-1 text-[11px] font-medium text-sky-600 dark:text-sky-400">Repeaked</p>
          ) : repeakedAt ? (
            <p className="mt-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Saved · {formatMarketPostedAt(repeakedAt)}
            </p>
          ) : null}
        </div>
      </header>

      <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-snug text-zinc-800 dark:text-zinc-100">
        {peak.text}
      </p>

      <PostActions postKey={`peak:${peak.id}`} title={peak.text} />
    </article>
  );
}
