"use client";

import { useMemo, useState } from "react";

import { PeakAiReplyBody } from "@/app/components/peak-ai/PeakAiReplyBody";
import { safeJson } from "@/lib/http";
import {
  PEAK_AI_DESK_EXAMPLES,
  PEAK_AI_DESK_PLACEHOLDER,
  appendDeskTurn,
  buildPeakAiDeskChatRequest,
  type PeakAiDeskTurn,
} from "@/lib/peak-ai/desk-chat";
import { peakAiToolStatusLabel } from "@/lib/peak-ai/uw-prompt";

export function PeakAiDeskChat({
  alreadyOnPeakflow = false,
}: {
  alreadyOnPeakflow?: boolean;
}) {
  const [text, setText] = useState("");
  const [turns, setTurns] = useState<PeakAiDeskTurn[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => text.trim().length > 0 && !status, [text, status]);

  async function submit(raw: string) {
    const prompt = raw.trim();
    if (!prompt || status) return;
    setError(null);
    setText("");
    setTurns((prev) => appendDeskTurn(prev, { role: "user", text: prompt }));
    setStatus(peakAiToolStatusLabel(prompt));
    try {
      const res = await fetch("/api/peak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(buildPeakAiDeskChatRequest(prompt)),
      });
      const data =
        (await safeJson<{ reply?: string; error?: string }>(res)) ?? {};
      if (!res.ok) {
        setError(
          data.error === "Unauthorized"
            ? "Sign in to ask Peak about a ticker or option."
            : (data.error ?? "Peak AI could not answer."),
        );
        return;
      }
      if (data.reply) {
        setTurns((prev) => appendDeskTurn(prev, { role: "peak", text: data.reply ?? "" }));
      } else {
        setError("Peak AI returned an empty desk note.");
      }
    } catch {
      setError("Could not reach Peak AI.");
    } finally {
      setStatus(null);
    }
  }

  return (
    <section
      data-testid="peak-ai-desk-chat"
      className="rounded-2xl border border-violet-200 bg-white px-4 py-3 shadow-sm dark:border-violet-900/50 dark:bg-zinc-950"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
          Peak AI
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Unusual Whales tape
        </p>
      </div>

      {turns.length > 0 ? (
        <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
          {turns.map((turn, index) => (
            <li
              key={`${turn.role}-${index}-${turn.text.slice(0, 12)}`}
              className={
                turn.role === "user"
                  ? "rounded-xl bg-zinc-100 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  : "rounded-xl border border-violet-200/70 px-3 py-2 dark:border-violet-900/40"
              }
            >
              {turn.role === "user" ? (
                <p className="text-sm">{turn.text}</p>
              ) : (
                <PeakAiReplyBody text={turn.text} alreadyOnPeakflow={alreadyOnPeakflow} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PEAK_AI_DESK_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:border-violet-300 hover:text-violet-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-violet-700 dark:hover:text-violet-300"
              onClick={() => setText(example)}
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {status ? (
        <p className="mt-2 text-xs font-semibold text-violet-700 dark:text-violet-300" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs font-medium text-rose-700 dark:text-rose-300">{error}</p>
      ) : null}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(text);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PEAK_AI_DESK_PLACEHOLDER}
          aria-label="Ask Peak about a ticker or option"
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-violet-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          disabled={Boolean(status)}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Ask
        </button>
      </form>
    </section>
  );
}
