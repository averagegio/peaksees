/** True for Peak AI / peak-post markets (real DB ids). */
export function isPeakGeneratedMarketCard(post: {
  id: string;
  pending?: boolean;
  marketSource?: string;
}): boolean {
  if (post.pending) return false;
  if (post.marketSource?.startsWith("peak")) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    post.id,
  );
}
