import "server-only";

import type { ProfilePeakFeedItem } from "@/app/lib/peak-market";
import { getPeakById, listPeaks } from "@/lib/peaks/store";
import { listPinEntries } from "@/lib/social/pins-store";
import type { Peak } from "@/lib/peaks/store";

function parsePeakPinId(postKey: string): string | null {
  if (!postKey.startsWith("peak:")) return null;
  const id = postKey.slice("peak:".length).trim();
  return id.length > 0 ? id : null;
}

function newerIso(a: string, b: string) {
  try {
    return new Date(a) >= new Date(b) ? a : b;
  } catch {
    return a;
  }
}

/** Posts you authored plus peaks you repeaked (pins), newest activity first. */
export async function buildProfileFeedItems(viewerUserId: string): Promise<ProfilePeakFeedItem[]> {
  const [myPeaks, pinEntries] = await Promise.all([
    listPeaks({ mineUserId: viewerUserId, limit: 40 }),
    listPinEntries(viewerUserId, 40),
  ]);

  const mineById = new Map(myPeaks.map((p) => [p.id, p]));
  const repeakedAtById = new Map<string, string>();
  for (const e of pinEntries) {
    const id = parsePeakPinId(e.postKey);
    if (id) repeakedAtById.set(id, e.createdAt);
  }

  const onlyRepeakedIds = [...repeakedAtById.keys()].filter((id) => !mineById.has(id));
  const fetched = (
    await Promise.all(onlyRepeakedIds.map((id) => getPeakById(id)))
  ).filter(Boolean) as Peak[];

  const byId = new Map<string, ProfilePeakFeedItem>();

  for (const p of myPeaks) {
    byId.set(p.id, {
      peak: p,
      market: null,
      repeakedAt: repeakedAtById.get(p.id) ?? null,
      isRepeak: false,
    });
  }

  for (const p of fetched) {
    if (byId.has(p.id)) continue;
    byId.set(p.id, {
      peak: p,
      market: null,
      repeakedAt: repeakedAtById.get(p.id) ?? null,
      isRepeak: true,
    });
  }

  return [...byId.values()].sort((a, b) => {
    const sa = newerIso(a.peak.createdAt, a.repeakedAt ?? a.peak.createdAt);
    const sb = newerIso(b.peak.createdAt, b.repeakedAt ?? b.peak.createdAt);
    return sb.localeCompare(sa);
  });
}
