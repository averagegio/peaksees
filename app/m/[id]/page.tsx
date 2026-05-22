import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PublicMarketShareView } from "@/app/components/market/PublicMarketShareView";
import { marketToPost } from "@/app/lib/peak-market";
import { appBaseUrl, marketShareImageUrl, marketSharePageUrl } from "@/lib/app-url";
import { getSession } from "@/lib/auth/session";
import { getMarketById, peakIdFromMarketSource } from "@/lib/markets/store";
import { getPeakById } from "@/lib/peaks/store";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const marketId = decodeURIComponent(id ?? "").trim();
  const market = marketId ? await getMarketById(marketId) : null;
  if (!market) {
    return { title: "Market not found · peaksees" };
  }

  const pageUrl = marketSharePageUrl(market.id);
  const imageUrl = marketShareImageUrl(market.id);
  const yesPct = Math.round(Number(market.yesProbability) * 100);
  const description = `Yes ${yesPct}% · ${market.category} · Trade this prediction on peaksees`;

  return {
    title: market.question,
    description,
    metadataBase: new URL(appBaseUrl()),
    openGraph: {
      title: market.question,
      description,
      url: pageUrl,
      siteName: "peaksees",
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: market.question,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: market.question,
      description,
      images: [imageUrl],
    },
  };
}

export default async function MarketSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const marketId = decodeURIComponent(id ?? "").trim();
  const market = marketId ? await getMarketById(marketId) : null;
  if (!market) notFound();

  const session = await getSession();
  if (session) {
    redirect(`/feed?m=${encodeURIComponent(market.id)}`);
  }

  const peakId = peakIdFromMarketSource(market.source);
  const peak = peakId ? await getPeakById(peakId) : null;
  const post = marketToPost(market, peak);
  const returnPath = `/feed?m=${encodeURIComponent(market.id)}`;

  return <PublicMarketShareView post={post} returnPath={returnPath} />;
}
