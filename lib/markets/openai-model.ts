import "server-only";

/** Default market-generation model; override with OPENAI_MODEL in env. */
export function openAIMarketModel(): string {
  return (process.env.OPENAI_MODEL ?? "gpt-5").trim();
}
