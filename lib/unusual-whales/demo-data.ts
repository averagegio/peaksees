import type { DashboardSnapshot } from "./types";

/** Labeled sample rows used when no Unusual Whales API key is configured. */
export function demoDashboardSnapshot(now = new Date()): DashboardSnapshot {
  const iso = now.toISOString();
  const t = now.getTime();
  return {
    source: "demo",
    generatedAt: iso,
    flow: {
      ok: true,
      error: null,
      rows: [
        {
          id: "demo-flow-1",
          ticker: "NVDA",
          type: "call",
          expiry: "2026-09-18",
          strike: "140",
          premium: 1842500,
          size: 4200,
          volume: 9100,
          openInterest: 1800,
          underlyingPrice: 128.4,
          createdAt: iso,
          optionChain: "NVDA260918C00140000",
          alertRule: "RepeatedHits",
        },
        {
          id: "demo-flow-2",
          ticker: "SPY",
          type: "put",
          expiry: "2026-09-11",
          strike: "640",
          premium: 962000,
          size: 3100,
          volume: 6400,
          openInterest: 2200,
          underlyingPrice: 648.12,
          createdAt: iso,
          optionChain: "SPY260911P00640000",
          alertRule: "Sweeps",
        },
        {
          id: "demo-flow-3",
          ticker: "TSLA",
          type: "call",
          expiry: "2026-10-16",
          strike: "280",
          premium: 540000,
          size: 1500,
          volume: 2800,
          openInterest: 900,
          underlyingPrice: 251.7,
          createdAt: iso,
          optionChain: "TSLA261016C00280000",
          alertRule: "AskSide",
        },
      ],
    },
    darkpool: {
      ok: true,
      error: null,
      rows: [
        {
          id: "demo-dp-1",
          ticker: "AAPL",
          price: 224.15,
          size: 185000,
          notional: 224.15 * 185000,
          executedAt: iso,
          venue: "FINRA",
        },
        {
          id: "demo-dp-2",
          ticker: "MSFT",
          price: 428.9,
          size: 92000,
          notional: 428.9 * 92000,
          executedAt: iso,
          venue: "FINRA",
        },
      ],
    },
    congress: {
      ok: true,
      error: null,
      rows: [
        {
          id: "demo-c-1",
          politician: "Sample Member",
          ticker: "AMZN",
          transaction: "Purchase",
          amount: "$15,001–$50,000",
          filedAt: iso.slice(0, 10),
          chamber: "House",
        },
        {
          id: "demo-c-2",
          politician: "Example Senator",
          ticker: "XOM",
          transaction: "Sale",
          amount: "$1,001–$15,000",
          filedAt: iso.slice(0, 10),
          chamber: "Senate",
        },
      ],
    },
    tide: {
      ok: true,
      error: null,
      rows: Array.from({ length: 8 }, (_, i) => {
        const netCall = 12_000_000 + i * 850_000;
        const netPut = 9_500_000 + (7 - i) * 400_000;
        return {
          timestamp: new Date(t - (7 - i) * 5 * 60_000).toISOString(),
          netCallPremium: netCall,
          netPutPremium: netPut,
          netPremium: netCall - netPut,
        };
      }),
    },
    screener: {
      ok: true,
      error: null,
      rows: [
        {
          id: "demo-s-1",
          ticker: "AMD",
          optionSymbol: "AMD260918C00180000",
          type: "call",
          premium: 410000,
          volume: 22000,
          openInterest: 4100,
          askSidePct: 0.72,
        },
        {
          id: "demo-s-2",
          ticker: "META",
          optionSymbol: "META260918P00500000",
          type: "put",
          premium: 280000,
          volume: 15000,
          openInterest: 3600,
          askSidePct: 0.31,
        },
      ],
    },
    news: {
      ok: true,
      error: null,
      rows: [
        {
          id: "demo-n-1",
          headline: "Demo headline: options flow concentrates in megacap calls",
          source: "Peaksees demo",
          createdAt: iso,
          url: "",
        },
        {
          id: "demo-n-2",
          headline: "Demo headline: dark pool prints lift into the close",
          source: "Peaksees demo",
          createdAt: iso,
          url: "",
        },
      ],
    },
  };
}
