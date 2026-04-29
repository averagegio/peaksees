"use client";

import { useState } from "react";

import { safeJson } from "@/lib/http";

export function AdvertisersForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);
    setBusy(true);
    try {
      const res = await fetch("/api/advertisers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, description }),
      });
      const data = (await safeJson<{ error?: string }>(res)) ?? {};
      if (!res.ok) {
        setError(data.error ?? "Could not send message");
        return;
      }
      setSent(true);
      setName("");
      setEmail("");
      setDescription("");
    } catch {
      setError("Could not send message");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="adv-name">
          Name
        </label>
        <input
          id="adv-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="adv-email">
          Email
        </label>
        <input
          id="adv-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          type="email"
          className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-zinc-800 dark:text-zinc-200" htmlFor="adv-desc">
          Description
        </label>
        <textarea
          id="adv-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={5}
          className="mt-1.5 w-full resize-none rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          placeholder="What do you want to advertise? Budget, target audience, dates, links…"
        />
      </div>

      {error ? (
        <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {sent ? (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
          Sent — we’ll reach out soon.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
      >
        {busy ? "Sending..." : "Send"}
      </button>
    </form>
  );
}

