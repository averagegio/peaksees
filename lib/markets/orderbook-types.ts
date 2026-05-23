export type OrderbookLevel = {
  priceCents: number;
  sizeShares: number;
  orders: number;
};

export type MarketSpread = {
  yesBidCents: number;
  yesAskCents: number;
  noBidCents: number;
  noAskCents: number;
  spreadCents: number;
};

export type MarketOrderbookPayload = {
  marketId: string;
  midYesCents: number;
  spread: MarketSpread;
  yes: { bids: OrderbookLevel[]; asks: OrderbookLevel[] };
  no: { bids: OrderbookLevel[]; asks: OrderbookLevel[] };
  updatedAt: string;
};
