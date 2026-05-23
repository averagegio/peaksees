import type { Market } from "@/lib/markets/store";
import { isMarketExpired, parseMarketEndsAtMs } from "@/lib/markets/market-status";

export type PayoutTimelineStep = {
  id: string;
  label: string;
  at: string;
  description: string;
  status: "past" | "current" | "upcoming";
};

export type MarketContractPayload = {
  marketId: string;
  contractId: string;
  contractUrl: string;
  question: string;
  category: string;
  resolutionCriteria: string;
  rulesSummary: string;
  rulesSections: { title: string; body: string }[];
  payoutTimeline: PayoutTimelineStep[];
};

function formatWhen(iso: string) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(ms)) + " UTC";
}

function addHoursIso(iso: string, hours: number) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms + hours * 3_600_000).toISOString();
}

export function buildPayoutTimeline(market: Market, nowMs = Date.now()): PayoutTimelineStep[] {
  const createdMs = Date.parse(market.createdAt);
  const endsMs = parseMarketEndsAtMs(market.endsAt);
  const closeIso =
    endsMs !== null ? new Date(endsMs).toISOString() : addHoursIso(market.createdAt, 24 * 30);
  const resolutionIso = addHoursIso(closeIso, 24);
  const payoutIso = addHoursIso(closeIso, 72);

  const steps: Omit<PayoutTimelineStep, "status">[] = [
    {
      id: "open",
      label: "Market opens",
      at: market.createdAt,
      description: "Trading is live on Yes and No shares with Peakpoints.",
    },
    {
      id: "close",
      label: "Trading closes",
      at: closeIso,
      description: "No new positions after the resolution deadline in the contract.",
    },
    {
      id: "resolve",
      label: "Outcome resolution",
      at: resolutionIso,
      description:
        market.resolvedSide != null
          ? `Resolved to ${market.resolvedSide.toUpperCase()}.`
          : "Peaksees resolves the market to Yes or No per the contract criteria.",
    },
    {
      id: "payout",
      label: "Winner payouts",
      at: payoutIso,
      description:
        "Winning shares settle to Peakpoints balances after escrow release (typically within 72h of close).",
    },
  ];

  let foundCurrent = false;
  return steps.map((step, i) => {
    const atMs = Date.parse(step.at);
    let status: PayoutTimelineStep["status"] = "upcoming";
    if (Number.isFinite(atMs) && atMs <= nowMs) {
      status = "past";
    } else if (!foundCurrent) {
      status = "current";
      foundCurrent = true;
    }
    if (i === steps.length - 1 && market.resolvedSide && status === "upcoming") {
      status = "past";
    }
    return {
      ...step,
      at: formatWhen(step.at),
      status,
    };
  });
}

export function buildMarketContract(
  market: Market,
  contractUrl: string,
): MarketContractPayload {
  const expired = isMarketExpired(market.endsAt);
  const resolutionCriteria = [
    `YES resolves if the statement in the market question is satisfied before ${formatWhen(market.endsAt)}.`,
    "NO resolves if YES does not resolve by the deadline.",
    "Ambiguous or cancelled real-world outcomes may be voided or extended at peaksees discretion with notice on this contract.",
  ].join(" ");

  const rulesSections = [
    {
      title: "Market question",
      body: market.question,
    },
    {
      title: "Resolution criteria",
      body: resolutionCriteria,
    },
    {
      title: "Trading",
      body:
        "Positions are funded with Peakpoints. Prices reflect implied probability (1–99¢ per share). Shares are held in escrow until settlement.",
    },
    {
      title: "Source of truth",
      body:
        "Public reporting from reputable news, league, or government sources for the named entities in the question. Peak AI–generated markets follow the same rules as user peaks.",
    },
    {
      title: "Category",
      body: `${market.category}${market.subcategory ? ` · ${market.subcategory}` : ""}`,
    },
    {
      title: "Status",
      body: market.resolvedSide
        ? `Resolved ${market.resolvedSide.toUpperCase()}${market.resolvedAt ? ` on ${formatWhen(market.resolvedAt)}` : ""}.`
        : expired
          ? "Trading closed — awaiting or completing resolution."
          : "Open for trading.",
    },
  ];

  return {
    marketId: market.id,
    contractId: `peaksees-${market.id}`,
    contractUrl,
    question: market.question,
    category: market.category,
    resolutionCriteria,
    rulesSummary:
      "This contract defines how Yes/No shares on this market resolve and when Peakpoints payouts are released.",
    rulesSections,
    payoutTimeline: buildPayoutTimeline(market),
  };
}
