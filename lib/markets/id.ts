/** Strip client namespace prefix; DB stores bare market ids (uuid or mock id). */
export function normalizeMarketId(marketId: string): string {
  const id = marketId.trim();
  if (!id) return id;
  return id.startsWith("market:") ? id.slice("market:".length) : id;
}
