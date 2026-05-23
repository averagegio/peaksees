import Link from "next/link";

import { SiteFooter } from "@/app/components/marketing/SiteFooter";
import { FEED_TAGLINE } from "@/lib/brand";

export function FeedSiteSection() {
  return (
    <section
      className="w-full border-t border-zinc-200 bg-white pb-24 dark:border-zinc-800 dark:bg-zinc-950 sm:pb-28"
      aria-labelledby="feed-about-heading"
    >
      <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:px-8 sm:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
          About peaksees
        </p>
        <h2
          id="feed-about-heading"
          className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50"
        >
          A social feed where we trade on opinions
        </h2>
        <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
          {FEED_TAGLINE}
        </p>
        <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
          peaksees turns posts into prediction markets. Peak AI and the community generate
          timely Yes / No markets from real peaks — you trade conviction with Peakpoints and
          follow creators across Trending, News, Sports, and Culture.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { title: "Post & peak", body: "Share a take or let Peak surface a market." },
            { title: "Trade", body: "Buy Yes or No; double-click or hold a card for depth." },
            { title: "Follow", body: "Track creators and explore by topic." },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900/50"
            >
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/about"
            className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Read more
          </Link>
          <Link
            href="/peakpoints"
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Peakpoints
          </Link>
        </div>
      </div>

      <SiteFooter />
    </section>
  );
}
