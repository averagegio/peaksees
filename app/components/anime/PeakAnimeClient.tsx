"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { PeakPlusBadge } from "@/app/components/membership/PeakPlusBadge";
import { safeJson } from "@/lib/http";
import type { MemberPlan } from "@/lib/membership/plans";
import { hasPeakProTier } from "@/lib/membership/plans";

type Episode = {
  id: string;
  userId: string;
  creatorName: string;
  creatorHandle: string;
  seriesTitle: string;
  title: string;
  episodeNumber: number;
  description: string;
  createdAt: string;
  videoUrl: string;
};

type UploadMode = "direct" | "server";

export function PeakAnimeClient({
  memberPlan,
  compact = false,
}: {
  memberPlan: MemberPlan;
  compact?: boolean;
}) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>("server");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const canUpload = hasPeakProTier(memberPlan);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/anime/episodes?limit=24", { cache: "no-store" });
      const data =
        (await safeJson<{ episodes?: Episode[]; uploadMode?: UploadMode }>(res)) ?? {};
      if (!res.ok) {
        setError("Could not load episodes");
        return;
      }
      const list = Array.isArray(data.episodes) ? data.episodes : [];
      setEpisodes(list);
      if (data.uploadMode === "direct" || data.uploadMode === "server") {
        setUploadMode(data.uploadMode);
      }
      setActiveId((prev) => prev ?? list[0]?.id ?? null);
      setError(null);
    } catch {
      setError("Could not load episodes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = episodes.find((e) => e.id === activeId) ?? episodes[0] ?? null;

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canUpload || uploadBusy) return;
    setUploadBusy(true);
    setError(null);
    setSuccess(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const seriesTitle = String(formData.get("seriesTitle") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const episodeNumber = Math.floor(Number(formData.get("episodeNumber") ?? "1"));
    const file = formData.get("video");

    if (!(file instanceof File)) {
      setError("Video file is required");
      setUploadBusy(false);
      return;
    }

    try {
      if (uploadMode === "direct") {
        const urlRes = await fetch("/api/anime/episodes/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name || "episode.mp4",
            mimeType: file.type || "video/mp4",
            sizeBytes: file.size,
            seriesTitle,
            title,
            description,
            episodeNumber,
          }),
        });
        const urlData =
          (await safeJson<{
            error?: string;
            uploadUrl?: string;
            episodeId?: string;
            storageKey?: string;
          }>(urlRes)) ?? {};
        if (!urlRes.ok || !urlData.uploadUrl || !urlData.episodeId || !urlData.storageKey) {
          setError(urlData.error ?? "Could not start upload");
          return;
        }

        const putRes = await fetch(urlData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "video/mp4" },
          body: file,
        });
        if (!putRes.ok) {
          setError("Upload to storage failed");
          return;
        }

        const completeRes = await fetch("/api/anime/episodes/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            episodeId: urlData.episodeId,
            storageKey: urlData.storageKey,
            fileName: file.name || "episode.mp4",
            mimeType: file.type || "video/mp4",
            seriesTitle,
            title,
            description,
            episodeNumber,
          }),
        });
        const completeData =
          (await safeJson<{ error?: string; episode?: Episode }>(completeRes)) ?? {};
        if (!completeRes.ok) {
          setError(completeData.error ?? "Could not publish episode");
          return;
        }
        setSuccess("Episode published!");
        form.reset();
        await load();
        if (completeData.episode?.id) setActiveId(completeData.episode.id);
        return;
      }

      const res = await fetch("/api/anime/episodes", { method: "POST", body: formData });
      const data = (await safeJson<{ error?: string; episode?: Episode }>(res)) ?? {};
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        return;
      }
      setSuccess("Episode published!");
      form.reset();
      await load();
      if (data.episode?.id) setActiveId(data.episode.id);
    } catch {
      setError("Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {!compact ? (
        <div className="rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-500/[0.08] via-violet-500/[0.06] to-transparent p-4 sm:p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-pink-600 dark:text-pink-300">
            Peak Anime
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-zinc-900 dark:text-zinc-50">
            AI-original anime episodes
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            PeakPro creators upload episodes of original AI anime. Everyone on peaksees can watch
            the latest drops here and on the Live tab.
          </p>
          {!canUpload ? (
            <Link
              href="/pricing"
              className="mt-3 inline-flex rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Upgrade to PeakPro to upload
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-pink-600 dark:text-pink-300">
              New Peak Anime
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Watch the latest AI-original episodes
            </p>
          </div>
          <Link
            href="/peak-anime"
            className="shrink-0 rounded-full border border-pink-500/40 px-3 py-1.5 text-xs font-semibold text-pink-700 hover:bg-pink-500/10 dark:text-pink-200"
          >
            Browse all
          </Link>
        </div>
      )}

      {active ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-black shadow-lg dark:border-zinc-700">
          <video
            key={active.id}
            src={active.videoUrl}
            controls
            playsInline
            className="aspect-video w-full bg-black"
          />
          <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-pink-300">
              {active.seriesTitle} · Ep {active.episodeNumber}
            </p>
            <p className="mt-1 text-base font-bold text-white">{active.title}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {active.creatorName} {active.creatorHandle}
            </p>
            {active.description ? (
              <p className="mt-2 text-sm text-zinc-300">{active.description}</p>
            ) : null}
          </div>
        </div>
      ) : !loading ? (
        <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No episodes yet. PeakPro creators can upload the first one.
        </p>
      ) : null}

      {canUpload ? (
        <form
          onSubmit={(ev) => void onUpload(ev)}
          className="rounded-2xl border border-violet-500/30 bg-violet-500/[0.06] p-4 dark:bg-violet-500/10"
        >
          <div className="mb-3 flex items-center gap-2">
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Upload episode</p>
            <PeakPlusBadge plan={memberPlan} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="seriesTitle"
              required
              placeholder="Series title"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
            <input
              name="title"
              required
              placeholder="Episode title"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
            <input
              name="episodeNumber"
              type="number"
              min={1}
              defaultValue={1}
              placeholder="Episode #"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
            />
            <input
              name="video"
              type="file"
              required
              accept="video/mp4,video/webm,video/quicktime"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-violet-600 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white dark:border-zinc-600 dark:bg-zinc-950"
            />
          </div>
          <textarea
            name="description"
            rows={2}
            placeholder="Short description (optional)"
            className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={uploadBusy}
            className="mt-3 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
          >
            {uploadBusy ? "Uploading…" : "Publish episode"}
          </button>
        </form>
      ) : null}

      {episodes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Latest episodes</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {episodes.map((ep) => (
              <button
                key={ep.id}
                type="button"
                onClick={() => setActiveId(ep.id)}
                className={
                  "rounded-xl border px-3 py-2.5 text-left transition " +
                  (active?.id === ep.id
                    ? "border-pink-500/50 bg-pink-500/10"
                    : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900")
                }
              >
                <p className="text-[11px] font-semibold text-pink-600 dark:text-pink-300">
                  {ep.seriesTitle} · Ep {ep.episodeNumber}
                </p>
                <p className="mt-0.5 text-sm font-bold text-zinc-900 dark:text-zinc-100">{ep.title}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">{ep.creatorName}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-zinc-500">Loading episodes…</p> : null}
      {error ? <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}
      {success ? (
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{success}</p>
      ) : null}
    </div>
  );
}
