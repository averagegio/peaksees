"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/pricing",
    label: "Pricing",
    subtitle: "PeakPlus & paid plans",
    icon: PricingIcon,
  },
  {
    href: "/advertisers",
    label: "Advertisers",
    subtitle: "Sponsorship options",
    icon: MegaphoneIcon,
  },
  {
    href: "/peakpoints",
    label: "Peakpoints",
    subtitle: "Wallet, deposits & ledger",
    icon: CoinIcon,
  },
  {
    href: "/peakstats",
    label: "Peakstats",
    subtitle: "Leaderboard by balance",
    icon: TrophyIcon,
  },
  {
    href: "/bookmarks",
    label: "Bookmarks",
    subtitle: "Posts you saved",
    icon: BookmarkIcon,
  },
  {
    href: "/mentions",
    label: "Mentions",
    subtitle: "@ you in the feed",
    icon: MentionsGlyph,
  },
] as const;

export function SidebarNav({
  onNavigate,
}: {
  onNavigate?: () => void;
} = {}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Feed navigation">
      {items.map(({ href, label, subtitle, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            data-tour={href === "/peakpoints" ? "nav-peakpoints" : undefined}
            aria-label={`${label}. ${subtitle}`}
            title={`${label} — ${subtitle}`}
            onClick={() => onNavigate?.()}
            className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors sm:gap-3 sm:px-3 sm:py-2.5 ${
              active
                ? "bg-emerald-500/15 ring-1 ring-emerald-500/20 dark:bg-emerald-500/12 dark:ring-emerald-500/25"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800/90"
            }`}
          >
            <span
              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border text-zinc-600 dark:border-zinc-600 dark:text-zinc-400 ${
                active
                  ? "border-emerald-600/35 bg-emerald-500/[0.12] dark:border-emerald-500/30 dark:bg-emerald-500/[0.10]"
                  : "border-zinc-200/90 bg-white dark:border-zinc-700 dark:bg-zinc-900/85"
              }`}
              aria-hidden
            >
              <Icon className="pointer-events-none size-[1.05rem] stroke-[1.65] text-current" />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block text-[14px] font-semibold leading-tight tracking-tight sm:text-[15px] ${
                  active
                    ? "text-emerald-900 dark:text-emerald-200"
                    : "text-zinc-900 dark:text-zinc-50"
                }`}
              >
                {label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                {subtitle}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65}>
      <path d="M6 3h12a2 2 0 012 2v16l-8-5-8 5V5a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MentionsGlyph({ className }: { className?: string }) {
  return (
    <span
      className={`flex size-[1.05rem] items-center justify-center rounded border-[0.5px] border-current font-mono text-[9px] font-bold leading-none ${className ?? ""}`}
      aria-hidden
    >
      @
    </span>
  );
}

function CoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65}>
      <path d="M12 2c5 0 9 1.8 9 4s-4 4-9 4-9-1.8-9-4 4-4 9-4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6v6c0 2.2 4 4 9 4s9-1.8 9-4V6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12v6c0 2.2 4 4 9 4s9-1.8 9-4v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PricingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65}>
      <path d="M7 7h10M7 12h10M7 17h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MegaphoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65}>
      <path d="M3 11v2a2 2 0 002 2h1l3 5h2l-2-5h2l10 3V6L11 9H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 9v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.65}>
      <path d="M8 21h8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 17v4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 4h10v4a5 5 0 01-10 0V4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 6H3v2a4 4 0 004 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 6h2v2a4 4 0 01-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

