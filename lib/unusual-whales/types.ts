export type FlowSide = "call" | "put" | "unknown";

export type FlowAlertRow = {
  id: string;
  ticker: string;
  type: FlowSide;
  expiry: string;
  strike: string;
  premium: number;
  size: number;
  volume: number;
  openInterest: number;
  underlyingPrice: number;
  createdAt: string;
  optionChain: string;
  alertRule: string;
};

export type DarkPoolRow = {
  id: string;
  ticker: string;
  price: number;
  size: number;
  notional: number;
  executedAt: string;
  venue: string;
};

export type CongressRow = {
  id: string;
  politician: string;
  ticker: string;
  transaction: string;
  amount: string;
  filedAt: string;
  chamber: string;
};

export type MarketTidePoint = {
  timestamp: string;
  netCallPremium: number;
  netPutPremium: number;
  netPremium: number;
};

export type ScreenerRow = {
  id: string;
  ticker: string;
  optionSymbol: string;
  type: FlowSide;
  premium: number;
  volume: number;
  openInterest: number;
  askSidePct: number;
};

export type NewsRow = {
  id: string;
  headline: string;
  source: string;
  createdAt: string;
  url: string;
};

export type DashboardSection<T> = {
  ok: boolean;
  error: string | null;
  rows: T[];
};

export type DashboardSnapshot = {
  source: "live" | "demo";
  generatedAt: string;
  flow: DashboardSection<FlowAlertRow>;
  darkpool: DashboardSection<DarkPoolRow>;
  congress: DashboardSection<CongressRow>;
  tide: DashboardSection<MarketTidePoint>;
  screener: DashboardSection<ScreenerRow>;
  news: DashboardSection<NewsRow>;
};

export type UnusualWhalesDesk = "subscriber" | "personal";
