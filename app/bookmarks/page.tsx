import Link from "next/link";

import { BackButton } from "@/app/components/BackButton";
import { FeedChrome } from "@/app/components/feed/FeedChrome";

export default function BookmarksPage() {
  return (
    <FeedChrome>
      <div className="mx-auto flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        <div className="mx-auto w-full max-w-lg px-3 py-8 sm:px-4 md:py-12">
          <BackButton fallbackHref="/feed" iconOnly className="mb-4" />
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/80">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Bookmarks</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Saved peaks and prediction markets will show up here.
            </p>
            <Link
              href="/feed"
              className="mt-6 inline-flex rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Back to feed
            </Link>
          </div>
        </div>
      </div>
    </FeedChrome>
  );
}



