import { FeedChrome } from "@/app/components/feed/FeedChrome";
import { FeedWithStories } from "@/app/feed/FeedWithStories";

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
      <FeedWithStories highlightMarketId={highlight} />
    </FeedChrome>
  );
}
