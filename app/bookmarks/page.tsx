import { redirect } from "next/navigation";

import { BookmarksList } from "@/app/components/bookmarks/BookmarksList";
import { BackButton } from "@/app/components/BackButton";
import { FeedChrome } from "@/app/components/feed/FeedChrome";
import { getSession } from "@/lib/auth/session";
import { buildBookmarkRows } from "@/lib/social/bookmarks-feed";

export default async function BookmarksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await buildBookmarkRows(session.user.id);

  return (
    <FeedChrome>
      <div className="mx-auto flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        <div className="mx-auto w-full max-w-lg px-3 py-8 sm:px-4 md:py-12">
          <BackButton fallbackHref="/feed" iconOnly className="mb-4" />
          <BookmarksList initialRows={rows} viewerUserId={session.user.id} />
        </div>
      </div>
    </FeedChrome>
  );
}
