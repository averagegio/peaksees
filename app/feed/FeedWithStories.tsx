"use client";

import { HomeFeedWithTabs } from "@/app/components/feed/HomeFeedWithTabs";
import { PeakStoriesRail } from "@/app/components/stories/PeakStoriesRail";

export function FeedWithStories({ highlightMarketId }: { highlightMarketId?: string }) {
  return (
    <div className="flex min-h-0 w-full flex-1 justify-center gap-4 px-3 py-3">
      <aside className="hidden min-h-0 w-72 shrink-0 xl:block">
        <div className="sticky top-3">
          <PeakStoriesRail />
        </div>
      </aside>
      <div className="min-h-0 w-full max-w-xl flex-1">
        <HomeFeedWithTabs highlightMarketId={highlightMarketId} />
      </div>
    </div>
  );
}

