"use client";

import Link from "next/link";
import { useState } from "react";

import { whalesUnlockScreen } from "@/lib/membership/personal-desk";

import { unlockWithToken } from "./WhalesDesk";
import { RegisterWhalesServiceWorker } from "./RegisterWhalesServiceWorker";

export function WhalesUnlockForm({ tokenConfigured }: { tokenConfigured: boolean }) {
  const screen = whalesUnlockScreen({ tokenConfigured });
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unlockWithToken(token);
      window.location.assign("/whales");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <RegisterWhalesServiceWorker />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
        Owner only
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Peak Flow</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Personal Unusual Whales desk at <code className="text-zinc-200">/whales</code>. Enter the
        Peak Flow owner token, or sign in with a PeakPlus Peaksees account. Admins can also sign
        in.
      </p>

      <form onSubmit={(e) => void submit(e)} className="mt-8 flex flex-col gap-3">
        <label className="text-sm font-medium text-zinc-200" htmlFor={screen.ownerTokenFieldId}>
          {screen.ownerTokenFieldLabel}
        </label>
        <p className="text-xs text-zinc-500">
          Paste <code className="text-emerald-300">UW_PERSONAL_ACCESS_TOKEN</code>. This is{" "}
          <span className="font-semibold text-zinc-300">not</span> your Unusual Whales API key (
          <code className="text-zinc-400">UNUSUAL_WHALES_API_KEY</code>).
        </p>
        {screen.showOwnerTokenField ? (
          <input
            id={screen.ownerTokenFieldId}
            data-testid="peak-flow-owner-token"
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-zinc-50 outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-2"
            required
          />
        ) : null}
        {screen.showNotConfiguredHint ? (
          <p className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
            Unlock isn&apos;t configured on the server yet. You can still enter a token — submitting
            will say so until <code className="text-emerald-300">UW_PERSONAL_ACCESS_TOKEN</code> is
            set and redeployed. PeakPlus sign-in does not need this token.
          </p>
        ) : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Unlocking…" : "Unlock desk"}
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href="/login?next=/whales" className="font-semibold text-emerald-400 hover:underline">
          Sign in with PeakPlus
        </Link>
        <Link href="/pricing" className="text-zinc-300 hover:underline">
          Upgrade to PeakPlus
        </Link>
        <Link href="/feed" className="text-zinc-400 hover:underline">
          Peaksees feed
        </Link>
      </div>
    </div>
  );
}
