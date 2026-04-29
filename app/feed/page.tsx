import { HomeFeedWithTabs } from "@/app/components/feed/HomeFeedWithTabs";
import { FeedChrome } from "@/app/components/feed/FeedChrome";

export default function FeedPage() {
  return (
    <FeedChrome showBackButton={false}>
      <HomeFeedWithTabs />
    </FeedChrome>
  );
}
