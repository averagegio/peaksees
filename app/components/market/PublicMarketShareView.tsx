import Link from "next/link";

import { MarketPostCard } from "@/app/components/PeakFeed";
import type { MarketPost } from "@/app/lib/mock-markets";

export function PublicMarketShareView({
  post,
  returnPath,
}: {
  post: MarketPost;
  /** Path to return to after sign-up or log-in. */
  returnPath: string;
}) {
  const next = encodeURIComponent(returnPath);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-zinc-100 to-zinc-200/90 px-4 py-8 dark:from-zinc-950 dark:to-zinc-900 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-5 text-center">
          <Link
            href="/"
            className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            peaksees
          </Link>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Preview this market — create a free account to trade Yes or No.
          </p>
        </header>

        <MarketPostCard post={post} readOnly />

        <section
          className="mt-5 rounded-2xl border border-emerald-200/80 bg-emerald-500/[0.06] p-4 text-center shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10"
          aria-label="Sign up to trade"
        >
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
            Ready to put your conviction on the line?
          </p>
          <p className="mt-1 text-[13px] text-zinc-600 dark:text-zinc-300">
            Sign up free to trade, bookmark, and unlock Peak insights on this market.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              href={`/signup?next=${next}`}
              className="inline-flex rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Create account
            </Link>
            <Link
              href={`/login?next=${next}`}
              className="inline-flex rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Log in
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
