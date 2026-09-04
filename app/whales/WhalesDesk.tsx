"use client";

import { UnusualWhalesBoard } from "@/app/components/unusual-whales/UnusualWhalesBoard";
import { safeJson } from "@/lib/http";
import type { DashboardSnapshot } from "@/lib/unusual-whales/types";

import { RegisterWhalesServiceWorker } from "./RegisterWhalesServiceWorker";

export function WhalesDesk({
  initial,
  lockable = true,
}: {
  initial: DashboardSnapshot;
  lockable?: boolean;
}) {
  async function lock() {
    await fetch("/api/whales/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    window.location.assign("/whales");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <RegisterWhalesServiceWorker />
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
            Personal
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight">Peak Flow</h1>
          <p className="mt-1 text-xs text-zinc-400">Unusual Whales desk · add to Home Screen</p>
        </div>
        {lockable ? (
          <button
            type="button"
            onClick={() => void lock()}
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200"
          >
            Lock
          </button>
        ) : null}
      </header>

      <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 [@media(display-mode:standalone)]:hidden">
        <p className="font-semibold">Install this app</p>
        <p className="mt-1 text-xs text-emerald-100/80">
          Safari: Share → Add to Home Screen. Chrome: menu → Install app. It opens standalone
          without the Peaksees feed chrome.
        </p>
      </div>

      <UnusualWhalesBoard desk="personal" compact initial={initial} />
    </div>
  );
}

export async function unlockWithToken(token: string) {
  const res = await fetch("/api/whales/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify({ token }),
  });
  const data = (await safeJson<{ error?: string; code?: string }>(res)) ?? {};
  if (!res.ok) throw new Error(data.error ?? "Unlock failed");
}
