"use client";

import { useEffect, useState } from "react";

import { safeJson } from "@/lib/http";

export function PeakOpinionChip({
  question,
  crowdYes,
  enabled,
}: {
  question: string;
  crowdYes: number;
  enabled: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [probYes, setProbYes] = useState<number | null>(null);
  const [disagree, setDisagree] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!enabled) return;
      setLoading(true);
      try {
        const res = await fetch("/api/peak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: question, outcomes: { yes: crowdYes, no: 1 - crowdYes } }),
        });
        const data =
          (await safeJson<{ meta?: { probYes?: number; disagree?: boolean } }>(res)) ??
          {};
        if (!res.ok) return;
        const p = Number(data.meta?.probYes);
        if (!cancelled && Number.isFinite(p)) {
          setProbYes(Math.max(0, Math.min(1, p)));
          setDisagree(Boolean(data.meta?.disagree));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, question, crowdYes]);

  if (!enabled) return null;

  const pct = probYes === null ? null : Math.round(probYes * 100);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
        Peak
      </span>
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {loading || pct === null ? "thinking…" : `${pct}% YES`}
      </span>
      {!loading && pct !== null ? (
        <span
          className={
            "rounded-full px-2 py-1 text-[11px] font-semibold " +
            (disagree
              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")
          }
        >
          {disagree ? "disagrees with crowd" : "aligns with crowd"}
        </span>
      ) : null}
    </div>
  );
}

