/** Investor projections for the peaksees pitch deck (illustrative model). */

export const TAM = {
  tam: { label: "TAM", value: "$48B", detail: "Global opinion markets, social prediction, and adjacent digital wagering" },
  sam: { label: "SAM", value: "$8.2B", detail: "English-language social + creator prediction markets online" },
  som: { label: "SOM", value: "$820M", detail: "Peaksees 5-year capture of high-intent social traders" },
} as const;

export const MAU_SERIES = [
  { year: "Y1", mau: 120_000, label: "120K", growth: null as string | null, note: "Launch cohort — Peak AI fills the marquee" },
  { year: "Y2", mau: 480_000, label: "480K", growth: "4.0×", note: "Embeds + first creator markets compound" },
  { year: "Y3", mau: 1_400_000, label: "1.4M", growth: "2.9×", note: "Weekly traders become the habit layer" },
  { year: "Y4", mau: 3_200_000, label: "3.2M", growth: "2.3×", note: "Global feeds + Peak Anime acquisition" },
  { year: "Y5", mau: 6_500_000, label: "6.5M", growth: "2.0×", note: "Category density across topics & regions" },
] as const;

export const FUNNEL = [
  { stage: "Visit", rate: "100%", note: "Feed & embed surfaces" },
  { stage: "Signup", rate: "28%", note: "Social graph + curiosity" },
  { stage: "First trade", rate: "41% of signups", note: "Peak AI + market card CTA" },
  { stage: "Weekly trader", rate: "22% of traders", note: "Depth + Peak dissent" },
  { stage: "Deposit", rate: "18% of weekly", note: "Stripe → Peakpoints" },
  { stage: "Retained 90d", rate: "34% of depositors", note: "Escrow wins + feed habit" },
] as const;

export const FUNDING_ROUNDS = [
  { round: "Pre-seed", amount: "$1.5M", focus: "Core feed, Peak AI, Peakpoints MVP" },
  { round: "Seed", amount: "$6M", focus: "Liquidity, Peak AI scale, growth loops" },
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
  { bucket: "Product & engineering", pct: 20, detail: "Feed, Peak AI gen, order books, escrow, Peak Anime, live" },
  { bucket: "Trust, compliance & payouts", pct: 12, detail: "KYC/AML path, withdrawal rails, resolution ops" },
  { bucket: "Ops & runway", pct: 8, detail: "Support, infra, contingency" },
] as const;

export const PRESEED_ASK = {
  amount: "$1.5M",
  runway: "18 months",
  use: "Ship depth UX, Peakpoints withdrawals at scale, and the first growth flywheel.",
} as const;

/** Peak AI — always-on market generation engine for the feed. */
export const PEAK_AI = {
  handle: "@peak",
  tagline: "Always-on market generation for the feed",
  pillars: [
    {
      title: "Sense",
      body: "Scans live news and culture signals across Trending, News, Sports, Culture, and Anime.",
    },
    {
      title: "Publish",
      body: "Writes sharp, forward-looking Yes/No markets into the feed via refresh + daily cron — same settlement rules as community peaks.",
    },
    {
      title: "Dissent",
      body: "After a trade, the peak badge reveals Peak AI’s dissent score versus the crowd — a second opinion that keeps traders coming back.",
    },
  ],
  flywheel:
    "Peak AI keeps the marquee stocked when creators are quiet, so every visit has a tradeable moment. Community peaks ride beside it — AI supply + human demand.",
} as const;
