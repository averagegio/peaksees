import { HomeFeedWithTabs } from "@/app/components/feed/HomeFeedWithTabs";
import { FeedChrome } from "@/app/components/feed/FeedChrome";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const highlight =
    typeof sp.m === "string" && sp.m.trim() ? sp.m.trim() : undefined;
  return (
    <FeedChrome showBackButton={false}>
      <HomeFeedWithTabs highlightMarketId={highlight} />
    </FeedChrome>
  );
}
