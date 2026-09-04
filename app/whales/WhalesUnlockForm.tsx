"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { unlockWithToken } from "./WhalesDesk";
import { RegisterWhalesServiceWorker } from "./RegisterWhalesServiceWorker";

export function WhalesUnlockForm({ tokenConfigured }: { tokenConfigured: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unlockWithToken(token);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
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
        Personal Unusual Whales desk. Sign in with an admin Peaksees account, or enter the
        personal access token.
      </p>

      {tokenConfigured ? (
        <form onSubmit={(e) => void submit(e)} className="mt-8 flex flex-col gap-3">
          <label className="text-sm font-medium text-zinc-200" htmlFor="uw-token">
            Access token
          </label>
          <input
            id="uw-token"
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-zinc-50 outline-none ring-emerald-500/30 focus:border-emerald-500 focus:ring-2"
            required
          />
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Unlocking…" : "Unlock desk"}
          </button>
        </form>
      ) : (
        <p className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
          Set <code className="text-emerald-300">UW_PERSONAL_ACCESS_TOKEN</code> or{" "}
          <code className="text-emerald-300">ADMIN_EMAILS</code> to unlock this app.
        </p>
      )}

      <div className="mt-6 flex gap-3 text-sm">
        <Link href="/login?next=/whales" className="font-semibold text-emerald-400 hover:underline">
          Owner sign in
        </Link>
        <Link href="/feed" className="text-zinc-400 hover:underline">
          Peaksees feed
        </Link>
      </div>
    </div>
  );
}
