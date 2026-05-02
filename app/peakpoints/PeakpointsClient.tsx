"use client";

import { useEffect, useState } from "react";

import { safeJson } from "@/lib/http";
import {
  PLATFORM_FEE_RATE,
  peakpointsCreditAfterDepositFee,
  payoutCentsAfterWithdrawFee,
} from "@/lib/peakpoints/fees";

type LedgerEntry = {
  id: string;
  kind: string;
  amountCents: number;
  createdAt: string;
  note: string | null;
};

function formatUsdCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function PeakpointsClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balanceCents, setBalanceCents] = useState(0);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [amount, setAmount] = useState(500);
  const [busy, setBusy] = useState<null | "deposit" | "withdraw">(null);

  const depositCreditPreview = peakpointsCreditAfterDepositFee(amount);
  const withdrawPayoutPreview = payoutCentsAfterWithdrawFee(amount);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/peakpoints", { cache: "no-store" });
        const data = (await safeJson<{
          balanceCents?: number;
          ledger?: LedgerEntry[];
          error?: string;
        }>(res)) ?? {};
        if (!res.ok) {
          throw new Error(
            data.error ??
              (res.status === 401 ? "Please log in first" : "Failed to load Peakpoints"),
          );
        }
        if (cancelled) return;
        setBalanceCents(Number(data.balanceCents ?? 0));
        setLedger(Array.isArray(data.ledger) ? data.ledger : []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load Peakpoints");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function act(action: "deposit" | "withdraw") {
    setBusy(action);
    setError(null);
    try {
      if (action === "deposit") {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "wallet_topup", amountCents: amount }),
        });
        const data = (await safeJson<{ url?: string; error?: string }>(res)) ?? {};
        if (!res.ok) {
          throw new Error(
            data.error ?? (res.status === 401 ? "Please log in first" : "Checkout failed"),
          );
        }
        if (!data.url) throw new Error("Missing checkout url");
        window.location.assign(data.url);
        return;
      }

      const res = await fetch("/api/peakpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, amountCents: amount }),
      });
      const data = (await safeJson<{
        balanceCents?: number;
        ledger?: LedgerEntry[];
        error?: string;
      }>(res)) ?? {};
      if (!res.ok) {
        throw new Error(
          data.error ?? (res.status === 401 ? "Please log in first" : "Action failed"),
        );
      }
      setBalanceCents(Number(data.balanceCents ?? 0));
      setLedger(Array.isArray(data.ledger) ? data.ledger : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Balance
          </p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            {loading ? "…" : formatUsdCents(balanceCents)}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Deposits: Stripe charges the amount below; Peakpoints credited are{" "}
            {Math.round((1 - PLATFORM_FEE_RATE) * 100)}% of payment (
            {Math.round(PLATFORM_FEE_RATE * 100)}% platform fee). Withdrawals deduct the full
            Peakpoints amount; estimated outbound cash after the{" "}
            {Math.round(PLATFORM_FEE_RATE * 100)}% withdrawal fee is shown next to Withdraw.
          </p>
        </div>

        <div className="flex items-end gap-2">
          <div>
            <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Amount (cents)
            </label>
            <input
              type="number"
              min={100}
              step={100}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="mt-1 w-32 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              ≈ {formatUsdCents(depositCreditPreview)} credited after deposit fee · withdraw
              nets ≈ {formatUsdCents(withdrawPayoutPreview)}
            </p>
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => act("deposit")}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy === "deposit" ? "Opening Checkout…" : "Add money"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => act("withdraw")}
            title={`Removes ${formatUsdCents(amount)} from balance; payout ≈ ${formatUsdCents(withdrawPayoutPreview)} after fee`}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            {busy === "withdraw" ? "Withdrawing…" : "Withdraw"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Activity
        </p>
        <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {ledger.length === 0 && !loading ? (
              <li className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
                No transactions yet.
              </li>
            ) : (
              ledger.map((e) => (
                <li key={e.id} className="p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {e.kind}
                    </span>
                    <span
                      className={
                        "font-semibold " +
                        (e.amountCents >= 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-zinc-700 dark:text-zinc-300")
                      }
                    >
                      {formatUsdCents(e.amountCents)}
                    </span>
                  </div>
                  {e.note ? (
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                      {e.note}
                    </p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

