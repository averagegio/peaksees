"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { TwitchLiveBetWidget } from "@/app/components/twitch/TwitchLiveBetWidget";

function TwitchEmbedPageInner() {
  const params = useSearchParams();
  const channel = params.get("channel")?.trim() ?? "";
  const market = params.get("market")?.trim() ?? "";
  const mode = params.get("mode") === "panel" ? "panel" : "overlay";
  const transparent = params.get("transparent") === "1" || mode === "overlay";

  return (
    <TwitchLiveBetWidget
      channel={channel || undefined}
      marketId={market || undefined}
      mode={mode}
      transparent={transparent}
    />
  );
}

export default function TwitchEmbedPage() {
  return (
    <Suspense fallback={null}>
      <TwitchEmbedPageInner />
    </Suspense>
  );
}
