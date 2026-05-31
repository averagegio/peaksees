"use client";

import { TwitchLiveBetWidget } from "@/app/components/twitch/TwitchLiveBetWidget";

export function TwitchEmbedMarketClient({
  marketId,
  mode,
  transparent,
}: {
  marketId: string;
  mode: "overlay" | "panel";
  transparent: boolean;
}) {
  return (
    <TwitchLiveBetWidget marketId={marketId} mode={mode} transparent={transparent} />
  );
}
