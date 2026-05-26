import { redirect } from "next/navigation";

import { AnimeFeedWithTabs } from "@/app/components/feed/AnimeFeedWithTabs";
import { FeedChrome } from "@/app/components/feed/FeedChrome";
import { getSession } from "@/lib/auth/session";

export default async function AnimePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <FeedChrome showBackButton={false}>
      <AnimeFeedWithTabs viewerUserId={session.user.id} />
    </FeedChrome>
  );
}
