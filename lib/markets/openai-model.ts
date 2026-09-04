import "server-only";

/**
 * Shared Peak AI model for market card generation and /api/peak chat
 * (including Unusual Whales desk questions). Override with OPENAI_MODEL.
 * Example in .env.example: gpt-4o-mini. Code default is gpt-5 if unset.
 */
export function openAIMarketModel(): string {
  return (process.env.OPENAI_MODEL ?? "gpt-5").trim();
}
