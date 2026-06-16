import { redirect } from "next/navigation";

import { HomeFeedWithTabs } from "@/app/components/feed/HomeFeedWithTabs";
import { FeedChrome } from "@/app/components/feed/FeedChrome";
import { getSession } from "@/lib/auth/session";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; peak?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

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
        viewerUserId={session.user.id}
        viewerMemberPlan={session.user.memberPlan}
      />
    </FeedChrome>
  );
}
