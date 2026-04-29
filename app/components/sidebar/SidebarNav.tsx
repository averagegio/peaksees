"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/pricing",
    label: "Pricing",
    icon: PricingIcon,
  },
  {
    href: "/advertisers",
    label: "Advertisers",
    icon: MegaphoneIcon,
  },
  {
    href: "/peakpoints",
    label: "Peakpoints",
    icon: CoinIcon,
  },
  {
    href: "/bookmarks",
    label: "Bookmarks",
    icon: BookmarkIcon,
  },
  {
    href: "/mentions",
    label: "Mentions",
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
    <nav className="flex flex-col gap-0.5" aria-label="Feed navigation">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={() => onNavigate?.()}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
              active
                ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/90"
            }`}
          >
            <Icon className="shrink-0 opacity-80" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function BookmarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M6 3h12a2 2 0 012 2v16l-8-5-8 5V5a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MentionsGlyph({ className }: { className?: string }) {
  return (
    <span
      className={`flex h-[1.25rem] w-[1.25rem] shrink-0 items-center justify-center rounded border border-current font-mono text-[10px] font-bold leading-none ${className ?? ""}`}
      aria-hidden
    >
      @
    </span>
  );
}

function CoinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2c5 0 9 1.8 9 4s-4 4-9 4-9-1.8-9-4 4-4 9-4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6v6c0 2.2 4 4 9 4s9-1.8 9-4V6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12v6c0 2.2 4 4 9 4s9-1.8 9-4v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PricingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M7 7h10M7 12h10M7 17h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MegaphoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 11v2a2 2 0 002 2h1l3 5h2l-2-5h2l10 3V6L11 9H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 9v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
