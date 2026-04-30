"use client";

import { useEffect, useMemo, useState } from "react";

import { safeJson } from "@/lib/http";

export function MarketTradeBox({
  marketId,
  yesProbability,
}: {
  marketId: string;
  yesProbability: number;
}) {
  const [amountCents, setAmountCents] = useState(500);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [balanceCents, setBalanceCents] = useState<number | null>(null);

  const yesPriceCents = useMemo(() => {
    const cents = Math.round(Number(yesProbability) * 100);
    return Math.min(99, Math.max(1, cents));
  }, [yesProbability]);
  const noPriceCents = useMemo(() => {
    const cents = Math.round((1 - Number(yesProbability)) * 100);
    return Math.min(99, Math.max(1, cents));
  }, [yesProbability]);

  useEffect(() => {
    let cancelled = false;
    async function loadBalance() {
      try {
        const res = await fetch("/api/peakpoints", { cache: "no-store" });
        const data =
          (await safeJson<{ balanceCents?: number; error?: string }>(res)) ?? {};
        if (!res.ok) return;
        if (!cancelled) setBalanceCents(Number(data.balanceCents ?? 0));
      } catch {
        // ignore
      }
    }
    void loadBalance();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(side: "yes" | "no") {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, side, amountCents }),
      });
      const data =
        (await safeJson<{ error?: string; trade?: { costCents: number } }>(res)) ??
        {};
      if (!res.ok) {
        setError(data.error ?? "Trade failed");
        return;
      }
      setOk("Bought in.");
      if (typeof data.trade?.costCents === "number") {
        setBalanceCents((prev) =>
          typeof prev === "number" ? prev - data.trade!.costCents : prev,
        );
      }
    } catch {
      setError("Trade failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Buy in with Peakpoints
        </p>
        {typeof balanceCents === "number" ? (
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
            Balance: {(balanceCents / 100).toFixed(2)}
          </p>
        ) : null}
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          Amount (cents)
          <input
            type="number"
            min={100}
            step={100}
            value={amountCents}
            onChange={(e) => setAmountCents(Math.floor(Number(e.target.value)))}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <div className="flex gap-2 sm:self-end">
          <button
            type="button"
            onClick={() => submit("yes")}
            disabled={busy}
            className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {busy ? "Buying…" : `Buy Yes · ${yesPriceCents}¢`}
          </button>
          <button
            type="button"
            onClick={() => submit("no")}
            disabled={busy}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {busy ? "Buying…" : `Buy No · ${noPriceCents}¢`}
          </button>
        </div>
      </div>

      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        You’ll get more shares at lower price. Trades spend Peakpoints immediately.
      </p>

      {ok ? (
        <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          {ok}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

