import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { PEAKSEES_BG_LOOP, PEAKSEES_HEADER_BANNER } from "@/lib/brand";

export default async function Home() {
  const session = await getSession();

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF background */}
        <img
          src={PEAKSEES_BG_LOOP}
          alt=""
          className="h-full w-full object-cover opacity-30 saturate-110"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(16,185,129,0.20),rgba(2,6,23,0.92)_55%,rgba(2,6,23,1)_100%)]" />
      </div>

      <section className="relative z-10 mx-auto flex w-full max-w-xl flex-col items-center rounded-3xl border border-emerald-400/20 bg-zinc-900/80 p-6 text-center shadow-2xl shadow-black/40 backdrop-blur-md sm:p-8">
        <Image
          src={PEAKSEES_HEADER_BANNER}
          alt="peaksees"
          width={580}
          height={180}
          className="h-auto w-full max-w-md object-contain"
          priority
        />

        <p className="mt-5 text-sm leading-relaxed text-zinc-200 sm:text-base">
          A social feed where people trade on opinions instead of just posting
          them.
        </p>

        <div className="mt-7 flex w-full max-w-sm flex-col gap-3">
          {session ? (
            <Link
              href="/feed"
              className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              Enter feed
            </Link>
          ) : (
            <>
              <Link
                href="/signup"
                className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
              >
                Create account
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-zinc-600 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
