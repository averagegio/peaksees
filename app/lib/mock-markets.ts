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
  subcategory?: string;
  hashtags?: string[];
  volumeUsd: number;
  endsAtLabel: string;
  outcomes: [Outcome, Outcome];
  /** True while the server is still creating the real market. */
  pending?: boolean;
  /** Real user profile link target (when set, links to /u/ instead of /p/). */
  profileUserId?: string;
  /** DB `markets.source` — peak_post, peak_refresh, etc. */
  marketSource?: string;
};
