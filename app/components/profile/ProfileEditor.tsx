"use client";

import { useState } from "react";

type ProfileEditorProps = {
  initialDisplayName: string;
  initialBio: string;
  initialAvatarUrl?: string;
  initialBannerUrl?: string;
};

export function ProfileEditor({
  initialDisplayName,
  initialBio,
  initialAvatarUrl = "",
  initialBannerUrl = "",
}: ProfileEditorProps) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSave() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, bio, avatarUrl, bannerUrl }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save profile");
        return;
      }
      setSaved(true);
      setEditing(false);
    } catch {
      setError("Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {!editing ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setSaved(false);
              setError(null);
            }}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Edit profile
          </button>
          {saved ? (
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Profile updated.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Header banner (max 2500×500)
            </p>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
              {bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL banner
                <img
                  src={bannerUrl}
                  alt=""
                  className="h-24 w-full object-cover sm:h-28"
                />
              ) : (
                <div className="h-24 w-full sm:h-28" />
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
              Upload header
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const dataUrl = await fileToResizedDataUrl(file, {
                      maxWidth: 2500,
                      maxHeight: 500,
                      mime: "image/jpeg",
                      quality: 0.82,
                    });
                    setBannerUrl(dataUrl);
                  } catch {
                    setError("Could not process header image.");
                  } finally {
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL avatar
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white/60 dark:ring-zinc-900"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  Photo
                </div>
              )}
              <label className="inline-flex cursor-pointer items-center rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
                Upload pic
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.type.startsWith("image/")) {
                      setError("Please choose an image file.");
                      return;
                    }
                    try {
                      const dataUrl = await fileToResizedDataUrl(file, {
                        maxWidth: 250,
                        maxHeight: 500,
                        mime: "image/jpeg",
                        quality: 0.82,
                      });
                      setAvatarUrl(dataUrl);
                    } catch {
                      setError("Could not process profile photo.");
                    } finally {
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Auto-resized to fit within 250×500.
            </p>
          </div>
          <div>
            <label
              htmlFor="dashboard-display-name"
              className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              Display name
            </label>
            <input
              id="dashboard-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={64}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label
              htmlFor="dashboard-bio"
              className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              Bio
            </label>
            <textarea
              id="dashboard-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={280}
              rows={4}
              className="mt-1 block w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
              placeholder="Add your bio..."
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={busy}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {busy ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDisplayName(initialDisplayName);
                setBio(initialBio);
                setAvatarUrl(initialAvatarUrl);
                setBannerUrl(initialBannerUrl);
                setEditing(false);
                setError(null);
              }}
              disabled={busy}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error ? (
        <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

async function fileToResizedDataUrl(
  file: File,
  opts: {
    maxWidth: number;
    maxHeight: number;
    mime: "image/jpeg" | "image/webp";
    quality: number;
  },
): Promise<string> {
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image load failed"));
      el.src = blobUrl;
    });

    const scale = Math.min(
      1,
      opts.maxWidth / img.naturalWidth,
      opts.maxHeight / img.naturalHeight,
    );
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unsupported");
    ctx.drawImage(img, 0, 0, w, h);

    return canvas.toDataURL(opts.mime, opts.quality);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
