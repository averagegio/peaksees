import Image from "next/image";
import Link from "next/link";

import { SiteFooter } from "@/app/components/marketing/SiteFooter";
import { getSession } from "@/lib/auth/session";
import {
  PEAKSEES_BG_LOOP,
  PEAKSEES_HEADER_BANNER,
  PEAKSEES_LANDING_HERO,
} from "@/lib/brand";

export default async function Home() {
  const session = await getSession();

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF background */}
        <img
          src={PEAKSEES_BG_LOOP}
          alt=""
          className="h-full w-full object-cover opacity-8 saturate-110 dark:opacity-15"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_50%,rgba(2,132,199,0.12),transparent_42%),radial-gradient(circle_at_70%_25%,rgba(16,185,129,0.12),transparent_35%)] dark:bg-[radial-gradient(circle_at_24%_50%,rgba(14,116,144,0.20),transparent_42%),radial-gradient(circle_at_70%_25%,rgba(16,185,129,0.20),transparent_35%)]" />
      </div>

      <section className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-[1fr_460px] lg:gap-14 lg:px-10">
        <div className="mx-auto w-full max-w-md lg:max-w-xl">
          <Image
            src={PEAKSEES_LANDING_HERO}
            alt="peaksees hero"
            width={900}
            height={700}
            className="mx-auto h-auto w-full max-w-[320px] rounded-2xl border border-zinc-300/80 object-cover shadow-xl shadow-zinc-900/15 dark:border-zinc-700 dark:shadow-black/30 sm:max-w-[420px] lg:max-w-[520px]"
            priority
          />
        </div>

        <div className="mx-auto w-full max-w-md">
          <h1 className="text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-6xl">
            Happening now
          </h1>
          <p className="mt-4 text-lg font-medium text-zinc-600 dark:text-zinc-300">
            Join peaksees today.
          </p>

          <div className="mt-6 rounded-2xl border border-zinc-300/80 bg-white/85 p-5 shadow-lg shadow-zinc-900/8 backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/85 dark:shadow-black/25">
            <Image
              src={PEAKSEES_HEADER_BANNER}
              alt="peaksees"
              width={520}
              height={160}
              className="h-auto w-full object-contain"
            />
            <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              A social feed where people trade on opinions instead of just
              posting them.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              {session ? (
                <Link
                  href="/feed"
                  className="rounded-full bg-zinc-900 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Enter feed
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="rounded-full bg-zinc-900 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Create account
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-full border border-zinc-300 px-5 py-3 text-center text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter className="relative z-10" />
    </main>
  );
}
