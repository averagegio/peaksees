"use client";

import { useState } from "react";

import { safeJson } from "@/lib/http";

export function GenerateMarketsClient() {
  const [count, setCount] = useState(80);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/cron/generate-markets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // In production, Vercel Cron will include auth; for manual runs set CRON_SECRET
          // by using a rewrite/proxy or calling with a client that can add headers.
        },
        body: JSON.stringify({ count }),
      });
      const data =
        (await safeJson<{ ok?: boolean; createdCount?: number; error?: string }>(
          res,
        )) ?? {};
      if (!res.ok) {
        setError(data.error ?? "Request failed");
        return;
      }
      setResult(`Created ${data.createdCount ?? 0} markets.`);
    } catch {
      setError("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        This triggers the daily Peak market generator. For security, set{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">CRON_SECRET</code>{" "}
        and call the endpoint with{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
          Authorization: Bearer
        </code>
        .
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          Count (50–100)
          <input
            type="number"
            min={50}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="mt-1 block w-32 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {busy ? "Generating…" : "Generate now"}
        </button>
      </div>

      {result ? (
        <p className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          {result}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm font-semibold text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

