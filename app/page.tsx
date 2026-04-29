import { HomeFeedWithTabs } from "@/app/components/feed/HomeFeedWithTabs";
import { FeedChrome } from "@/app/components/feed/FeedChrome";

export default function Home() {
  return (
    <FeedChrome showBackButton={false}>
      <HomeFeedWithTabs />
    </FeedChrome>
  );
}
