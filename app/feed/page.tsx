import { HomeFeedWithTabs } from "@/app/components/feed/HomeFeedWithTabs";
import { FeedChrome } from "@/app/components/feed/FeedChrome";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; peak?: string }>;
}) {
  const sp = await searchParams;
  const highlightMarket =
    typeof sp.m === "string" && sp.m.trim() ? sp.m.trim() : undefined;
  const highlightPeak =
    typeof sp.peak === "string" && sp.peak.trim() ? sp.peak.trim() : undefined;
  return (
    <FeedChrome showBackButton={false} interactiveFeedTour>
      <HomeFeedWithTabs
        highlightMarketId={highlightMarket}
        highlightPeakId={highlightPeak}
      />
    </FeedChrome>
  );
}
