import { TwitchEmbedMarketClient } from "@/app/components/twitch/TwitchEmbedMarketClient";

export default async function MarketEmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; transparent?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const marketId = decodeURIComponent(id ?? "").trim();
  const mode = sp.mode === "panel" ? "panel" : "overlay";
  const transparent = sp.transparent === "1" || mode === "overlay";

  return (
    <TwitchEmbedMarketClient marketId={marketId} mode={mode} transparent={transparent} />
  );
}
