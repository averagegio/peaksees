import "server-only";

import {
  marketSharePageUrl,
  twitchEmbedMarketUrl,
  twitchEmbedPanelUrl,
  twitchEmbedOverlayUrl,
} from "@/lib/app-url";
import { isMarketTradingOpen } from "@/lib/markets/market-status";
import type { Market } from "@/lib/markets/store";
import { getPinnedMarketForChannel, normalizeTwitchChannelLogin } from "@/lib/twitch/store";

export type TwitchWidgetPayload = {
  channel: string | null;
  market: {
    id: string;
    question: string;
    category: string;
    yesProbability: number;
    noProbability: number;
    yesPriceCents: number;
    noPriceCents: number;
    volumeCents: number;
    endsAt: string;
    resolvedSide: string | null;
    tradingOpen: boolean;
  };
  links: {
    betUrl: string;
    marketUrl: string;
    overlayEmbedUrl: string;
    panelEmbedUrl: string;
    marketEmbedUrl: string;
  };
};

function clampPriceCents(n: number) {
  if (!Number.isFinite(n)) return 50;
  return Math.min(99, Math.max(1, Math.floor(n)));
}

export function marketToTwitchWidgetPayload(
  market: Market,
  opts?: { channel?: string | null },
): TwitchWidgetPayload {
  const yesP = Number(market.yesProbability) || 0.5;
  const noP = Number(market.noProbability) || 1 - yesP;
  const channel = opts?.channel ?? null;

  return {
    channel,
    market: {
      id: market.id,
      question: market.question,
      category: market.category,
      yesProbability: yesP,
      noProbability: noP,
      yesPriceCents: clampPriceCents(Math.round(yesP * 100)),
      noPriceCents: clampPriceCents(Math.round(noP * 100)),
      volumeCents: market.volumeCents,
      endsAt: market.endsAt,
      resolvedSide: market.resolvedSide,
      tradingOpen: isMarketTradingOpen({
        endsAt: market.endsAt,
        resolvedSide: market.resolvedSide,
      }),
    },
    links: {
      betUrl: `${marketSharePageUrl(market.id)}?src=twitch`,
      marketUrl: marketSharePageUrl(market.id),
      overlayEmbedUrl: channel
        ? twitchEmbedOverlayUrl({ channel })
        : twitchEmbedOverlayUrl({ marketId: market.id }),
      panelEmbedUrl: channel
        ? twitchEmbedPanelUrl({ channel })
        : twitchEmbedPanelUrl({ marketId: market.id }),
      marketEmbedUrl: twitchEmbedMarketUrl(market.id, "panel"),
    },
  };
}

export async function resolveTwitchWidgetMarket(input: {
  channel?: string;
  marketId?: string;
}): Promise<{ marketId: string; channel: string | null } | null> {
  const explicitMarket = input.marketId?.trim();
  if (explicitMarket) {
    const channel = input.channel ? normalizeTwitchChannelLogin(input.channel) : null;
    return { marketId: explicitMarket, channel: channel || null };
  }

  const channel = input.channel ? normalizeTwitchChannelLogin(input.channel) : "";
  if (channel) {
    const pin = await getPinnedMarketForChannel(channel);
    if (pin) return { marketId: pin.marketId, channel: pin.channelLogin };
  }

  const defaultChannel = normalizeTwitchChannelLogin(process.env.TWITCH_DEFAULT_CHANNEL ?? "");
  const defaultMarket = (process.env.TWITCH_DEFAULT_MARKET_ID ?? "").trim();
  if (defaultChannel && defaultMarket && (!channel || channel === defaultChannel)) {
    return { marketId: defaultMarket, channel: defaultChannel };
  }

  return null;
}
