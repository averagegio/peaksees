"use client";

import { FollowUserButton } from "@/app/components/profile/FollowUserButton";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function ProfileFollowSocial(props: {
  targetUserId: string;
  viewerUserId: string;
  showFollowButton: boolean;
  initialFollowers: number;
  initialFollowing: number;
  initialIsFollowing: boolean;
}) {
  const viewingSelf = props.viewerUserId === props.targetUserId;
  const showFollow =
    props.showFollowButton && !viewingSelf && props.viewerUserId.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-zinc-600 dark:text-zinc-400">
        <span>
          <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatCount(props.initialFollowers)}
          </span>{" "}
          {props.initialFollowers === 1 ? "follower" : "followers"}
        </span>
        <span aria-hidden className="text-zinc-300 dark:text-zinc-600">
          ·
        </span>
        <span>
          <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatCount(props.initialFollowing)}
          </span>{" "}
          following
        </span>
      </div>
      {showFollow ? (
        <FollowUserButton
          targetUserId={props.targetUserId}
          viewerUserId={props.viewerUserId}
          initialIsFollowing={props.initialIsFollowing}
        />
      ) : null}
    </div>
  );
}
