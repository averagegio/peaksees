"use client";

import React, { useRef, useState } from "react";
import { FeedMarketHero } from "@/app/components/feed/FeedMarketHero";
import type { MarketPost } from "@/app/lib/mock-markets";

export default function MarqueeTestPage() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const mockPosts: MarketPost[] = [
    {
      id: "test-1",
      creator: "Peak AI",
      handle: "@peak",
      avatarHue: 220,
      postedAt: "Just now",
      question: "Will the price of Bitcoin exceed $100k by end of year?",
      category: "Finance",
      volumeUsd: 124500,
      endsAtLabel: "Dec 31",
      outcomes: [
        { id: "y", label: "Yes", probability: 0.42 },
        { id: "n", label: "No", probability: 0.58 },
      ],
    },
    {
      id: "test-2",
      creator: "Peak AI",
      handle: "@peak",
      avatarHue: 18,
      postedAt: "1h",
      question: "Will Team A win the championship this season?",
      category: "Sports",
      volumeUsd: 84500,
      endsAtLabel: "Season",
      outcomes: [
        { id: "y", label: "Yes", probability: 0.33 },
        { id: "n", label: "No", probability: 0.67 },
      ],
    },
    {
      id: "test-3",
      creator: "Peak AI",
      handle: "@peak",
      avatarHue: 98,
      postedAt: "2h",
      question: "Will product X launch before Q4?",
      category: "Tech",
      volumeUsd: 40120,
      endsAtLabel: "Q4",
      outcomes: [
        { id: "y", label: "Yes", probability: 0.7 },
        { id: "n", label: "No", probability: 0.3 },
      ],
    },
    {
      id: "test-4",
      creator: "Peak AI",
      handle: "@peak",
      avatarHue: 280,
      postedAt: "3h",
      question: "Will the movie win Best Picture?",
      category: "Culture",
      volumeUsd: 12300,
      endsAtLabel: "Awards",
      outcomes: [
        { id: "y", label: "Yes", probability: 0.18 },
        { id: "n", label: "No", probability: 0.82 },
      ],
    },
    {
      id: "test-5",
      creator: "Peak AI",
      handle: "@peak",
      avatarHue: 46,
      postedAt: "4h",
      question: "Will next week’s earnings beat analyst expectations?",
      category: "Finance",
      volumeUsd: 67200,
      endsAtLabel: "Next Week",
      outcomes: [
        { id: "y", label: "Yes", probability: 0.51 },
        { id: "n", label: "No", probability: 0.49 },
      ],
    },
    {
      id: "test-6",
      creator: "Peak AI",
      handle: "@peak",
      avatarHue: 136,
      postedAt: "5h",
      question: "Will the next viral app reach 10 million downloads in 30 days?",
      category: "Tech",
      volumeUsd: 35400,
      endsAtLabel: "30 Days",
      outcomes: [
        { id: "y", label: "Yes", probability: 0.62 },
        { id: "n", label: "No", probability: 0.38 },
      ],
    },
    {
      id: "test-7",
      creator: "Peak AI",
      handle: "@peak",
      avatarHue: 310,
      postedAt: "6h",
      question: "Will the new streaming series get renewed for season 2?",
      category: "Culture",
      volumeUsd: 29400,
      endsAtLabel: "Season",
      outcomes: [
        { id: "y", label: "Yes", probability: 0.44 },
        { id: "n", label: "No", probability: 0.56 },
      ],
    },
    {
      id: "test-8",
      creator: "Peak AI",
      handle: "@peak",
      avatarHue: 60,
      postedAt: "7h",
      question: "Will the environmental bill pass before the end of the month?",
      category: "Politics",
      volumeUsd: 26400,
      endsAtLabel: "This Month",
      outcomes: [
        { id: "y", label: "Yes", probability: 0.29 },
        { id: "n", label: "No", probability: 0.71 },
      ],
    },
  ];

  async function handlePullRefresh() {
    setPullRefreshing(true);
    // simulate network delay
    await new Promise((r) => setTimeout(r, 900));
    setPullRefreshing(false);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="mb-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Marquee Test</h1>
        <div style={{ height: 520 }}>
          <FeedMarketHero
            posts={mockPosts}
            viewerUserId={undefined}
            tourMarketPostIndex={0}
            viewportRef={viewportRef}
            sentinelRef={sentinelRef}
            highlightMarketId={undefined}
            onActiveIndexChange={() => {}}
            exploreLabel="Testing"
            loadHint={null}
            onPullRefresh={handlePullRefresh}
            pullRefreshing={pullRefreshing}
            pageScrollAtTop={true}
          />
        </div>
      </main>
    </div>
  );
}
