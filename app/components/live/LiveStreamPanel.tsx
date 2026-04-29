"use client";

import MuxPlayer from "@mux/mux-player-react";
import { useEffect, useRef, useState } from "react";

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
  const [goingLive, setGoingLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<LiveState | null>(null);
  const [created, setCreated] = useState<CreateResult | null>(null);
  const [previewOn, setPreviewOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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

  async function startPreview() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      mediaRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPreviewOn(true);
    } catch {
      setError("Camera/mic permission denied.");
    }
  }

  function stopPreview() {
    recorderRef.current?.stop();
    wsRef.current?.close();
    wsRef.current = null;
    recorderRef.current = null;
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    mediaRef.current = null;
    setPreviewOn(false);
    setGoingLive(false);
  }

  async function goLiveFromBrowser() {
    setError(null);
    setGoingLive(true);
    try {
      // Always create a live stream so we have a valid RTMP target.
      const res = await fetch("/api/live", { method: "POST" });
      const data = (await res.json()) as CreateResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Unable to create live stream");
      setCreated(data);

      // Relay is required because Mux doesn't accept WebRTC ingest directly.
      // This must be provided as a public env var for the browser.
      const relayUrl = (process.env.NEXT_PUBLIC_STREAM_RELAY_URL ?? "").trim();
      if (!relayUrl) {
        throw new Error(
          "Missing NEXT_PUBLIC_STREAM_RELAY_URL (browser->RTMP relay required).",
        );
      }
      if (!mediaRef.current) {
        await startPreview();
      }
      const stream = mediaRef.current;
      if (!stream) throw new Error("No camera stream available");

      const ws = new WebSocket(relayUrl);
      wsRef.current = ws;
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("Relay connection failed"));
      });

      ws.send(
        JSON.stringify({
          type: "start",
          rtmpUrl: data.rtmpUrl,
          streamKey: data.streamKey,
        }),
      );

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8,opus",
        videoBitsPerSecond: 2_000_000,
      });
      recorderRef.current = recorder;
      recorder.ondataavailable = async (ev) => {
        if (!ev.data || ev.data.size === 0) return;
        if (ws.readyState !== WebSocket.OPEN) return;
        const buf = await ev.data.arrayBuffer();
        ws.send(buf);
      };
      recorder.start(500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to go live");
      setGoingLive(false);
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

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
          onClick={previewOn ? stopPreview : startPreview}
          disabled={creating || goingLive}
        >
          {previewOn ? "Stop camera preview" : "Start camera preview"}
        </button>
        <button
          type="button"
          className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          onClick={goLiveFromBrowser}
          disabled={goingLive}
        >
          {goingLive ? "Going live..." : "Go live from browser"}
        </button>
      </div>

      {previewOn ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-video w-full bg-black"
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
