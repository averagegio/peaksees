"use client";

import {
  Room,
  RoomEvent,
  Track,
  createLocalVideoTrack,
  createLocalAudioTrack,
} from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

import { safeJson } from "@/lib/http";

type LiveConfig = {
  configured: boolean;
  url: string | null;
  roomName?: string;
  provider?: string;
};

type TokenResponse = {
  token?: string;
  url?: string;
  roomName?: string;
  role?: string;
  error?: string;
};

export function LiveStreamPanel() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<LiveConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "publisher" | "viewer">(null);
  const [connectedRole, setConnectedRole] = useState<null | "publisher" | "viewer">(
    null,
  );

  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const disconnectRoom = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      room.removeAllListeners();
      await room.disconnect();
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setConnectedRole(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        const data =
          (await safeJson<LiveConfig & { error?: string }>(res)) ??
          ({} as LiveConfig & { error?: string });
        if (!res.ok) {
          throw new Error(data.error ?? "Unable to load live config");
        }
        if (!cancelled) setConfig(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load live config");
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

  useEffect(() => {
    return () => {
      void disconnectRoom();
    };
  }, [disconnectRoom]);

  function attachRemoteTracks(
    room: Room,
    videoEl: HTMLVideoElement,
    audioEl: HTMLAudioElement | null,
  ) {
    const tryAttach = () => {
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.videoTrackPublications.values()) {
          const t = pub.track;
          if (t && t.kind === Track.Kind.Video) {
            t.attach(videoEl);
          }
        }
        for (const pub of p.audioTrackPublications.values()) {
          const t = pub.track;
          if (t && audioEl) {
            t.attach(audioEl);
          }
        }
      }
    };
    tryAttach();
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Video) {
        track.attach(videoEl);
      }
      if (track.kind === Track.Kind.Audio && audioEl) {
        track.attach(audioEl);
        void audioEl.play().catch(() => {});
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach();
    });
  }

  async function connectAs(role: "publisher" | "viewer") {
    if (!config?.url) {
      setError("LiveKit URL is not configured.");
      return;
    }
    setError(null);
    setBusy(role);
    await disconnectRoom();

    try {
      const res = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = (await safeJson<TokenResponse>(res)) ?? {};
      if (!res.ok) {
        throw new Error(data.error ?? "Could not join room");
      }
      if (!data.token || !data.url) {
        throw new Error("Missing token or URL from server");
      }

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      await room.connect(data.url, data.token);

      if (role === "publisher") {
        const videoTrack = await createLocalVideoTrack({
          resolution: { width: 1280, height: 720, frameRate: 30 },
        });
        const audioTrack = await createLocalAudioTrack();
        const stream = new MediaStream([videoTrack.mediaStreamTrack, audioTrack.mediaStreamTrack]);
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          await localVideoRef.current.play().catch(() => {});
        }
        await room.localParticipant.publishTrack(videoTrack);
        await room.localParticipant.publishTrack(audioTrack);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      } else {
        if (remoteVideoRef.current) {
          attachRemoteTracks(room, remoteVideoRef.current, remoteAudioRef.current);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
      }

      setConnectedRole(role);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      await disconnectRoom();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-4 rounded-2xl border border-zinc-200/90 bg-white/95 p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Live (LiveKit)
        </h2>
        {connectedRole ? (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400">
            CONNECTED
          </span>
        ) : (
          <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
            OFFLINE
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : null}

      {!loading && config && !config.configured ? (
        <div className="space-y-2 rounded-xl border border-dashed border-amber-300/80 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium text-amber-950 dark:text-amber-100">
            LiveKit is not configured
          </p>
          <p className="text-amber-900/90 dark:text-amber-200/90">
            Add{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">
              LIVEKIT_API_KEY
            </code>
            ,{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">
              LIVEKIT_API_SECRET
            </code>
            , and{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">
              NEXT_PUBLIC_LIVEKIT_URL
            </code>{" "}
            (your project WebSocket URL, e.g.{" "}
            <span className="whitespace-nowrap">wss://…livekit.cloud</span>). Optional:{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/60">
              LIVEKIT_ROOM
            </code>{" "}
            (default <code className="rounded px-1">peaksees-live</code>).
          </p>
        </div>
      ) : null}

      {!loading && config?.configured ? (
        <>
          <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
            Room: <span className="font-mono text-zinc-700 dark:text-zinc-300">{config.roomName}</span>
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              onClick={() => void connectAs("publisher")}
              disabled={busy !== null || connectedRole !== null}
            >
              {busy === "publisher" ? "Connecting…" : "Go live (camera)"}
            </button>
            <button
              type="button"
              className="rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => void connectAs("viewer")}
              disabled={busy !== null || connectedRole !== null}
            >
              {busy === "viewer" ? "Connecting…" : "Watch live"}
            </button>
          </div>

          {connectedRole ? (
            <button
              type="button"
              className="mt-2 w-full rounded-full border border-red-300/80 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/70"
              onClick={() => void disconnectRoom()}
            >
              Leave room
            </button>
          ) : null}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {connectedRole === "publisher" ? "Your stream" : "Preview (publisher)"}
              </p>
              <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
                <video
                  ref={localVideoRef}
                  muted
                  playsInline
                  className="aspect-video w-full bg-black object-cover"
                />
              </div>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {connectedRole === "viewer" ? "Live feed" : "Remote (when watching)"}
              </p>
              <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
                <video
                  ref={remoteVideoRef}
                  playsInline
                  className="aspect-video w-full bg-black object-cover"
                />
              </div>
              <audio ref={remoteAudioRef} className="hidden" autoPlay playsInline />
            </div>
          </div>

          {connectedRole === "viewer" ? (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Waiting for someone to go live, or connect as publisher in another window to test.
            </p>
          ) : null}
        </>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </section>
  );
}
