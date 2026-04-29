"use client";

import MuxPlayer from "@mux/mux-player-react";
import { useEffect, useState } from "react";

type LiveState = {
  configured: boolean;
  playbackId: string | null;
  status: string;
  source: string;
  canCreate: boolean;
};

type CreateResult = {
  liveStreamId: string;
  playbackId: string | null;
  streamKey: string;
  status: string;
  rtmpUrl: string;
};

export function LiveStreamPanel() {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<LiveState | null>(null);
  const [created, setCreated] = useState<CreateResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        const data = (await res.json()) as LiveState & { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Unable to load live stream");
        }
        if (!cancelled) setState(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load live stream");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createLiveStream() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/live", { method: "POST" });
      const data = (await res.json()) as CreateResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Unable to create live stream");
      setCreated(data);
      setState((prev) =>
        prev
          ? {
              ...prev,
              configured: Boolean(data.playbackId),
              playbackId: data.playbackId,
              status: data.status,
            }
          : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create live stream");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="mb-4 rounded-2xl border border-zinc-200/90 bg-white/95 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Live now
        </h2>
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400">
          LIVE
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading stream…</p>
      ) : null}

      {!loading && state?.configured && state.playbackId ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
          <MuxPlayer
            playbackId={state.playbackId}
            streamType="live"
            autoPlay={false}
            muted={false}
            accentColor="#10b981"
            className="aspect-video w-full"
          />
        </div>
      ) : null}

      {!loading && !state?.configured ? (
        <div className="space-y-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">
            No live playback configured yet.
          </p>
          <p className="text-zinc-600 dark:text-zinc-400">
            Set `MUX_PLAYBACK_ID` for an existing stream, or create one now from
            this tab.
          </p>
          {state?.canCreate ? (
            <button
              type="button"
              onClick={createLiveStream}
              disabled={creating}
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {creating ? "Creating…" : "Create Mux live stream"}
            </button>
          ) : null}
        </div>
      ) : null}

      {created ? (
        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-zinc-700 dark:text-zinc-200">
          <p>
            <strong>RTMP URL:</strong> {created.rtmpUrl}
          </p>
          <p className="mt-1 break-all">
            <strong>Stream Key:</strong> {created.streamKey}
          </p>
          <p className="mt-1 break-all">
            <strong>Playback ID:</strong> {created.playbackId ?? "Pending"}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}
