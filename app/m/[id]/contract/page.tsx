import Link from "next/link";
import { notFound } from "next/navigation";

import { marketContractPageUrl, marketSharePageUrl } from "@/lib/app-url";
import { buildMarketContract } from "@/lib/markets/market-contract";
import { getMarketById } from "@/lib/markets/store";

export default async function MarketContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const marketId = decodeURIComponent(id ?? "").trim();
  const market = marketId ? await getMarketById(marketId) : null;
  if (!market) notFound();

  const contract = buildMarketContract(market, marketContractPageUrl(market.id));

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-white px-4 py-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        Market contract
      </p>
      <h1 className="mt-2 text-xl font-semibold leading-snug">{contract.question}</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{contract.rulesSummary}</p>
      <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-500">
        {contract.contractId}
      </p>

      <div className="mt-8 space-y-6">
        {contract.rulesSections.map((section) => (
          <section key={section.title}>
            <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {section.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Payout timeline</h2>
        <ol className="mt-3 space-y-3">
          {contract.payoutTimeline.map((step) => (
            <li
              key={step.id}
              className="rounded-xl border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{step.label}</span>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                    (step.status === "past"
                      ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      : step.status === "current"
                        ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500")
                  }
                >
                  {step.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{step.at}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-10 flex flex-wrap gap-3 text-sm font-semibold">
        <Link
          href={marketSharePageUrl(market.id)}
          className="rounded-full bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500"
        >
          Back to market
        </Link>
        <Link
          href="/feed"
          className="rounded-full border border-zinc-300 px-4 py-2 dark:border-zinc-700"
        >
          Open feed
        </Link>
      </div>
    </main>
  );
}
