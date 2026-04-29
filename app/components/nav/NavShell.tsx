"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { BackButton } from "@/app/components/BackButton";
import { LogoutButton } from "@/app/components/LogoutButton";
import { SidebarNav } from "@/app/components/sidebar/SidebarNav";
import { FEED_TAGLINE, PEAKSEES_HEADER_BANNER } from "@/lib/brand";
import type { PublicUser } from "@/lib/auth/users-store";

function initials(displayName: string) {
  return (
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export function NavShell({
  session,
  showBackButton = true,
  children,
}: {
  session: { user: PublicUser } | null;
  showBackButton?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-30 shrink-0 border-b border-zinc-200/90 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
        <Link
          href="/feed"
          className="flex w-full items-center justify-center bg-white px-4 py-3 sm:py-4 dark:bg-zinc-950"
          onClick={() => setOpen(false)}
        >
          <Image
            src={PEAKSEES_HEADER_BANNER}
            alt="peaksees — prediction markets"
            width={720}
            height={220}
            className="h-auto w-full max-h-[92px] max-w-xl object-contain sm:max-h-[112px]"
            sizes="(max-width: 768px) 100vw, 36rem"
            priority
          />
        </Link>

        <p className="border-t border-zinc-100 bg-white px-4 py-2 text-center text-[12px] leading-snug tracking-tight text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          {FEED_TAGLINE}
        </p>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            {showBackButton && (
              <BackButton fallbackHref="/feed" label="Back" iconOnly />
            )}
            <button
              type="button"
              ref={firstFocusableRef}
              aria-expanded={open}
              aria-controls="peaksees-drawer-menu"
              aria-label={open ? "Close navigation menu" : "Open navigation menu"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              onClick={() => setOpen((x) => !x)}
            >
              <svg
                className={`h-[1.15rem] w-[1.15rem] transition-transform duration-150 ${open ? "rotate-90" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                {open ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          <div className="min-w-0 flex-1" aria-hidden />

          <div className="flex shrink-0 items-center gap-2">
            {session ? (
              <Link
                href="/dashboard"
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white ring-2 ring-emerald-500/30"
                style={{ backgroundColor: "hsl(160 45% 38%)" }}
                aria-label={`${session.user.displayName} profile`}
              >
                {session.user.avatarUrl?.trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL avatar
                  <img
                    src={session.user.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(session.user.displayName)
                )}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-full px-2.5 py-1 text-sm font-semibold text-zinc-700 sm:px-3 dark:text-zinc-300"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 sm:px-3 sm:text-sm"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Overlay + drawer */}
      <div
        className={`fixed inset-0 z-[100] transition-[visibility,opacity] duration-200 ${
          open ? "visible opacity-100" : "pointer-events-none invisible opacity-0"
        }`}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          aria-label="Close menu"
          tabIndex={open ? 0 : -1}
          onClick={close}
        />
        <nav
          id="peaksees-drawer-menu"
          className={`absolute left-0 top-0 flex h-full w-[min(20rem,92vw)] max-w-full flex-col border-r border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ease-out dark:border-zinc-800 dark:bg-zinc-950 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-hidden={!open}
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
            <Image
              src={PEAKSEES_HEADER_BANNER}
              alt=""
              width={320}
              height={96}
              className="h-10 max-h-10 w-auto max-w-[12rem] object-contain object-left opacity-95 dark:brightness-[1.02]"
            />
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Close navigation"
              onClick={close}
            >
              ✕
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            {/* Profile */}
            <div className="mb-5">
              {session ? (
                <Link
                  href="/dashboard"
                  className="group flex gap-3 rounded-2xl p-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  onClick={close}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-emerald-500/30"
                    style={{ backgroundColor: "hsl(160 45% 38%)" }}
                    aria-hidden
                  >
                    {initials(session.user.displayName)}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="truncate font-semibold text-zinc-900 dark:text-white">
                      {session.user.displayName}
                    </p>
                    <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                      @{session.user.email.split("@")[0]}
                    </p>
                    <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      View profile →
                    </p>
                  </div>
                </Link>
              ) : (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Join peaksees</p>
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    Prediction markets & social peaks.
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    <Link
                      href="/login"
                      className="block rounded-xl bg-zinc-900 py-2 text-center text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                      onClick={close}
                    >
                      Log in
                    </Link>
                    <Link
                      href="/signup"
                      className="block rounded-xl border border-zinc-300 py-2 text-center text-sm font-semibold dark:border-zinc-600 dark:hover:bg-zinc-800"
                      onClick={close}
                    >
                      Sign up
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Feed
            </p>
            <SidebarNav onNavigate={close} />

            <div className="mt-8 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              {session ? (
                <LogoutButton className="w-full rounded-xl border border-zinc-200 bg-zinc-100 py-2.5 text-center text-sm font-semibold text-zinc-800 no-underline hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800" />
              ) : null}
              <p className="mt-4 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                Prediction markets · social feed.
              </p>
            </div>
          </div>
        </nav>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}





