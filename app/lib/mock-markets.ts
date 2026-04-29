export type Outcome = {
  id: string;
  label: string;
  probability: number;
};

export type MarketPost = {
  id: string;
  creator: string;
  handle: string;
  avatarHue: number;
  postedAt: string;
  question: string;
  category: string;
  volumeUsd: number;
  endsAtLabel: string;
  outcomes: [Outcome, Outcome];
};

export const MARKET_FEED_FOR_YOU: MarketPost[] = [
  {
    id: "1",
    creator: "Nina Park",
    handle: "@nina_predictions",
    avatarHue: 210,
    postedAt: "2h ago",
    question: "Will the next flagship phone ship with under-screen Face ID?",
    category: "Tech",
    volumeUsd: 48_200,
    endsAtLabel: "Dec 31, 2026",
    outcomes: [
      { id: "y", label: "Yes", probability: 0.62 },
      { id: "n", label: "No", probability: 0.38 },
    ],
  },
  {
    id: "2",
    creator: "Omar Reyes",
    handle: "@omar_line",
    avatarHue: 28,
    postedAt: "5h ago",
    question: "Will opening weekend box office exceed $120M domestically?",
    category: "Entertainment",
    volumeUsd: 112_450,
    endsAtLabel: "Jul 21, 2026",
    outcomes: [
      { id: "y", label: "Yes", probability: 0.71 },
      { id: "n", label: "No", probability: 0.29 },
    ],
  },
  {
    id: "3",
    creator: "Sydney Cho",
    handle: "@sydmacro",
    avatarHue: 160,
    postedAt: "Yesterday",
    question: "Will core CPI YoY fall below 2.5% this quarter?",
    category: "Economy",
    volumeUsd: 256_890,
    endsAtLabel: "Sep 30, 2026",
    outcomes: [
      { id: "y", label: "Yes", probability: 0.44 },
      { id: "n", label: "No", probability: 0.56 },
    ],
  },
  {
    id: "4",
    creator: "Devon Miles",
    handle: "@devon_sports",
    avatarHue: 330,
    postedAt: "Yesterday",
    question: "Will the home team win the conference finals in 6 games or fewer?",
    category: "Sports",
    volumeUsd: 33_010,
    endsAtLabel: "Jun 2, 2026",
    outcomes: [
      { id: "y", label: "Yes", probability: 0.53 },
      { id: "n", label: "No", probability: 0.47 },
    ],
  },
  {
    id: "5",
    creator: "Iris Malik",
    handle: "@iris_climate",
    avatarHue: 190,
    postedAt: "3d ago",
    question: "Will global renewables capacity growth beat IEA forecasts this year?",
    category: "Climate",
    volumeUsd: 89_400,
    endsAtLabel: "Jan 15, 2027",
    outcomes: [
      { id: "y", label: "Yes", probability: 0.67 },
      { id: "n", label: "No", probability: 0.33 },
    ],
  },
  {
    id: "6",
    creator: "Leo Vance",
    handle: "@leo_policy",
    avatarHue: 265,
    postedAt: "4d ago",
    question: "Will a bipartisan infrastructure bill clear committee before recess?",
    category: "Politics",
    volumeUsd: 174_620,
    endsAtLabel: "Aug 10, 2026",
    outcomes: [
      { id: "y", label: "Yes", probability: 0.39 },
      { id: "n", label: "No", probability: 0.61 },
    ],
  },
];

/** Curated subset for the “Following” timeline (accounts you follow). */
export const MARKET_FEED_FOLLOWING: MarketPost[] = [
  {
    id: "f1",
    creator: "Nina Park",
    handle: "@nina_predictions",
    avatarHue: 210,
    postedAt: "30m ago",
    question: "Will edge-AI benchmarks double YoY within 18 months?",
    category: "Tech",
    volumeUsd: 31_900,
    endsAtLabel: "Mar 1, 2027",
    outcomes: [
      { id: "y", label: "Yes", probability: 0.54 },
      { id: "n", label: "No", probability: 0.46 },
    ],
  },
  {
    id: "f2",
    creator: "Omar Reyes",
    handle: "@omar_line",
    avatarHue: 28,
    postedAt: "2h ago",
    question: "Will the awards show hit a streaming record this year?",
    category: "Entertainment",
    volumeUsd: 76_120,
    endsAtLabel: "Feb 10, 2027",
    outcomes: [
      { id: "y", label: "Yes", probability: 0.61 },
      { id: "n", label: "No", probability: 0.39 },
    ],
  },
  {
    id: "f3",
    creator: "Iris Malik",
    handle: "@iris_climate",
    avatarHue: 190,
    postedAt: "6h ago",
    question: "Will quarterly solar installs exceed wind for the first time?",
    category: "Climate",
    volumeUsd: 142_050,
    endsAtLabel: "Apr 1, 2027",
    outcomes: [
      { id: "y", label: "Yes", probability: 0.48 },
      { id: "n", label: "No", probability: 0.52 },
    ],
  },
  {
    id: "f4",
    creator: "Sydney Cho",
    handle: "@sydmacro",
    avatarHue: 160,
    postedAt: "1d ago",
    question: "Will the Fed pause rate cuts until Q4?",
    category: "Economy",
    volumeUsd: 198_440,
    endsAtLabel: "Oct 31, 2026",
    outcomes: [
      { id: "y", label: "Yes", probability: 0.57 },
      { id: "n", label: "No", probability: 0.43 },
    ],
  },
];

export const MARKET_FEED_LIVE: MarketPost[] = [
  {
    id: "l1",
    creator: "Kai Stream",
    handle: "@kai_live",
    avatarHue: 8,
    postedAt: "Live now",
    question: "Will BTC break above $85k before this stream ends tonight?",
    category: "Live",
    volumeUsd: 342_000,
    endsAtLabel: "Tonight",
    outcomes: [
      { id: "y", label: "Yes", probability: 0.58 },
      { id: "n", label: "No", probability: 0.42 },
    ],
  },
  {
    id: "l2",
    creator: "Arena Desk",
    handle: "@arenalive",
    avatarHue: 280,
    postedAt: "Live now",
    question: "Will the underdog complete a comeback in the 2nd half?",
    category: "Live Sports",
    volumeUsd: 129_700,
    endsAtLabel: "In-game",
    outcomes: [
      { id: "y", label: "Yes", probability: 0.36 },
      { id: "n", label: "No", probability: 0.64 },
    ],
  },
  {
    id: "l3",
    creator: "Macro Wire",
    handle: "@macro_wire",
    avatarHue: 198,
    postedAt: "Starting in 12m",
    question: "Will the Fed chair mention 'sticky inflation' in today's remarks?",
    category: "Live News",
    volumeUsd: 211_840,
    endsAtLabel: "Today",
    outcomes: [
      { id: "y", label: "Yes", probability: 0.47 },
      { id: "n", label: "No", probability: 0.53 },
    ],
  },
];
