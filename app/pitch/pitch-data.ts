/** Investor projections for the peaksees pitch deck (illustrative model). */

export const TAM = {
  tam: { label: "TAM", value: "$48B", detail: "Global opinion markets, social prediction, and adjacent digital wagering" },
  sam: { label: "SAM", value: "$8.2B", detail: "English-language social + creator prediction markets online" },
  som: { label: "SOM", value: "$820M", detail: "Peaksees 5-year capture of high-intent social traders" },
} as const;

export const MAU_SERIES = [
  { year: "Y1", mau: 120_000, label: "120K" },
  { year: "Y2", mau: 480_000, label: "480K" },
  { year: "Y3", mau: 1_400_000, label: "1.4M" },
  { year: "Y4", mau: 3_200_000, label: "3.2M" },
  { year: "Y5", mau: 6_500_000, label: "6.5M" },
] as const;

export const FUNNEL = [
  { stage: "Visit", rate: "100%", note: "Feed & embed surfaces" },
  { stage: "Signup", rate: "28%", note: "Social graph + curiosity" },
  { stage: "First trade", rate: "41% of signups", note: "Market card CTA" },
  { stage: "Weekly trader", rate: "22% of traders", note: "Depth + notifications" },
  { stage: "Deposit", rate: "18% of weekly", note: "Stripe → Peakpoints" },
  { stage: "Retained 90d", rate: "34% of depositors", note: "Escrow wins + feed habit" },
] as const;

export const FUNDING_ROUNDS = [
  { round: "Pre-seed", amount: "$1.5M", focus: "Core feed + Peakpoints MVP" },
  { round: "Seed", amount: "$6M", focus: "Liquidity, market gen, growth loops" },
  { round: "Series A", amount: "$25M", focus: "Scale MAU & creator markets" },
  { round: "Series B", amount: "$75M", focus: "Global expansion + embeds" },
  { round: "Series C", amount: "$150M", focus: "Institutional depth & compliance" },
  { round: "Series D", amount: "$300M", focus: "Platform moat & media partnerships" },
  { round: "Series E", amount: "$450M", focus: "Multi-region liquidity hubs" },
  { round: "Series F", amount: "$600M", focus: "Enterprise & advertiser stack" },
  { round: "Series G–L", amount: "$2.4B cum.", focus: "Category ownership through late growth" },
  { round: "Series M", amount: "$1.2B", focus: "Public-markets readiness & global brand" },
] as const;

/** How raised capital is allocated toward growth (model weights). */
export const GROWTH_ALLOCATION = [
  { bucket: "User acquisition & brand", pct: 38, detail: "Paid social, creator collabs, viral market embeds" },
  { bucket: "Liquidity & trader incentives", pct: 22, detail: "Market maker incentives, Peakpoints rewards, fee rebates" },
  { bucket: "Product & engineering", pct: 20, detail: "Feed, order books, escrow, Peak Anime, live" },
  { bucket: "Trust, compliance & payouts", pct: 12, detail: "KYC/AML path, withdrawal rails, resolution ops" },
  { bucket: "Ops & runway", pct: 8, detail: "Support, infra, contingency" },
] as const;

export const PRESEED_ASK = {
  amount: "$1.5M",
  runway: "18 months",
  use: "Ship depth UX, Peakpoints withdrawals at scale, and the first growth flywheel.",
} as const;
