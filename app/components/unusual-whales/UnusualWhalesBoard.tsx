"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { safeJson } from "@/lib/http";
import { formatCompact, formatUsd, formatWhen } from "@/lib/unusual-whales/format";
import { latestTideBias } from "@/lib/unusual-whales/parse";
import type {
  CongressRow,
  DarkPoolRow,
  DashboardSnapshot,
  FlowAlertRow,
  NewsRow,
  ScreenerRow,
} from "@/lib/unusual-whales/types";

type Tab = "flow" | "darkpool" | "congress" | "screener" | "news";

const TABS: { id: Tab; label: string }[] = [
  { id: "flow", label: "Flow" },
  { id: "darkpool", label: "Dark pool" },
  { id: "congress", label: "Congress" },
  { id: "screener", label: "Screener" },
  { id: "news", label: "News" },
];

export function UnusualWhalesBoard({
  desk,
  compact = false,
  initial,
}: {
  desk: "subscriber" | "personal";
  compact?: boolean;
  initial?: DashboardSnapshot | null;
}) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initial);
  const [tab, setTab] = useState<Tab>("flow");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/unusual-whales/dashboard?desk=${desk}`, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await safeJson<DashboardSnapshot & { error?: string }>(res);
      if (!res.ok) {
        setError(data?.error ?? "Could not load Unusual Whales data");
        setSnapshot(null);
        return;
      }
      if (!data) {
        setError("Empty response");
        return;
      }
      setSnapshot(data);
      setError(null);
    } catch {
      setError("Could not load Unusual Whales data");
    } finally {
      setLoading(false);
    }
  }, [desk]);

  const tideBias = useMemo(
    () => latestTideBias(snapshot?.tide.rows ?? []),
    [snapshot],
  );

  if (loading && !snapshot) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
        Loading Unusual Whales desk…
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
        <p className="font-semibold">Could not load the desk</p>
        <p className="mt-1">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-xl bg-rose-700 px-3 py-2 text-xs font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!snapshot) return null;

  return (
    <div className="flex flex-col gap-4">
      {snapshot.source === "demo" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          Showing labeled demo data. Set{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">UNUSUAL_WHALES_API_KEY</code>{" "}
          for live Unusual Whales prints.
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Net tide"
          value={
            tideBias === "call" ? "Call heavy" : tideBias === "put" ? "Put heavy" : "Flat"
          }
          hint={
            snapshot.tide.rows.length
              ? formatUsd(snapshot.tide.rows[snapshot.tide.rows.length - 1]?.netPremium ?? 0)
              : snapshot.tide.error ?? "No ticks"
          }
          tone={tideBias === "call" ? "up" : tideBias === "put" ? "down" : "neutral"}
        />
        <Stat
          label="Flow alerts"
          value={String(snapshot.flow.rows.length)}
          hint={snapshot.flow.error ?? "Unusual prints"}
        />
        <Stat
          label="Dark pool"
          value={String(snapshot.darkpool.rows.length)}
          hint={snapshot.darkpool.error ?? "Recent blocks"}
        />
        <Stat
          label="Congress"
          value={String(snapshot.congress.rows.length)}
          hint={snapshot.congress.error ?? "Disclosures"}
        />
      </section>

      <TideSpark points={snapshot.tide.rows.map((p) => p.netPremium)} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                tab === item.id
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-200 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Refresh
        </button>
      </div>

      {tab === "flow" ? <FlowTable rows={snapshot.flow.rows} error={snapshot.flow.error} compact={compact} /> : null}
      {tab === "darkpool" ? (
        <DarkPoolTable rows={snapshot.darkpool.rows} error={snapshot.darkpool.error} />
      ) : null}
      {tab === "congress" ? (
        <CongressTable rows={snapshot.congress.rows} error={snapshot.congress.error} />
      ) : null}
      {tab === "screener" ? (
        <ScreenerTable rows={snapshot.screener.rows} error={snapshot.screener.error} />
      ) : null}
      {tab === "news" ? <NewsList rows={snapshot.news.rows} error={snapshot.news.error} /> : null}

      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        Data via Unusual Whales REST (cached ~45s). Official MCP:{" "}
        <Link
          href="https://api.unusualwhales.com/api/mcp"
          className="underline-offset-2 hover:underline"
        >
          api.unusualwhales.com/api/mcp
        </Link>
        . Updated {formatWhen(snapshot.generatedAt)}.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "up" | "down" | "neutral";
}) {
  const color =
    tone === "up"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "down"
        ? "text-rose-700 dark:text-rose-300"
        : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className={`mt-1 text-sm font-extrabold ${color}`}>{value}</p>
      <p className="mt-0.5 truncate text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>
    </div>
  );
}

function TideSpark({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 28 - ((p - min) / span) * 24;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Market Tide
      </p>
      <svg viewBox="0 0 100 32" className="mt-2 h-16 w-full" aria-hidden>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" className="text-emerald-600" />
      </svg>
    </div>
  );
}

function EmptyOrError({ error, empty }: { error: string | null; empty: boolean }) {
  if (error) {
    return <p className="px-4 py-5 text-sm text-rose-700 dark:text-rose-300">{error}</p>;
  }
  if (empty) {
    return <p className="px-4 py-5 text-sm text-zinc-600 dark:text-zinc-300">No rows yet.</p>;
  }
  return null;
}

function SideBadge({ type }: { type: string }) {
  const call = type === "call";
  const put = type === "put";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
        call
          ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
          : put
            ? "bg-rose-500/15 text-rose-800 dark:text-rose-200"
            : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300"
      }`}
    >
      {type}
    </span>
  );
}

function CardTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {children}
    </div>
  );
}

function FlowTable({
  rows,
  error,
  compact,
}: {
  rows: FlowAlertRow[];
  error: string | null;
  compact: boolean;
}) {
  return (
    <CardTable>
      <EmptyOrError error={error} empty={rows.length === 0} />
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-zinc-900 dark:text-zinc-100">{row.ticker}</span>
                <SideBadge type={row.type} />
                {row.alertRule ? (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    {row.alertRule}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {row.strike ? `${row.strike} ` : ""}
                {row.expiry ? `exp ${row.expiry}` : ""}
                {row.optionChain && !compact ? ` · ${row.optionChain}` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
                {formatUsd(row.premium)}
              </p>
              <p className="text-[11px] text-zinc-500">
                sz {formatCompact(row.size)} · vol {formatCompact(row.volume)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </CardTable>
  );
}

function DarkPoolTable({ rows, error }: { rows: DarkPoolRow[]; error: string | null }) {
  return (
    <CardTable>
      <EmptyOrError error={error} empty={rows.length === 0} />
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-extrabold text-zinc-900 dark:text-zinc-100">{row.ticker}</p>
              <p className="text-xs text-zinc-500">
                {row.venue} · {formatWhen(row.executedAt)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-extrabold">{formatUsd(row.notional)}</p>
              <p className="text-[11px] text-zinc-500">
                {formatCompact(row.size)} @ {formatUsd(row.price)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </CardTable>
  );
}

function CongressTable({ rows, error }: { rows: CongressRow[]; error: string | null }) {
  return (
    <CardTable>
      <EmptyOrError error={error} empty={rows.length === 0} />
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                {row.politician}
              </p>
              <p className="text-xs text-zinc-500">
                {row.chamber} · {row.filedAt}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-extrabold">{row.ticker}</p>
              <p className="text-[11px] text-zinc-500">
                {row.transaction} {row.amount}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </CardTable>
  );
}

function ScreenerTable({ rows, error }: { rows: ScreenerRow[]; error: string | null }) {
  return (
    <CardTable>
      <EmptyOrError error={error} empty={rows.length === 0} />
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold">{row.ticker}</span>
                <SideBadge type={row.type} />
              </div>
              <p className="text-xs text-zinc-500">{row.optionSymbol || "contract"}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-extrabold">{formatUsd(row.premium)}</p>
              <p className="text-[11px] text-zinc-500">vol {formatCompact(row.volume)}</p>
            </div>
          </li>
        ))}
      </ul>
    </CardTable>
  );
}

function NewsList({ rows, error }: { rows: NewsRow[]; error: string | null }) {
  return (
    <CardTable>
      <EmptyOrError error={error} empty={rows.length === 0} />
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map((row) => (
          <li key={row.id} className="px-4 py-3">
            {row.url ? (
              <a href={row.url} className="font-semibold text-zinc-900 hover:underline dark:text-zinc-100">
                {row.headline}
              </a>
            ) : (
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">{row.headline}</p>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              {row.source} · {formatWhen(row.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </CardTable>
  );
}
