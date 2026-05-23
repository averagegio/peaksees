import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/accessibility", label: "Accessibility" },
  { href: "/developers", label: "Developers" },
  { href: "/careers", label: "Careers" },
  { href: "/brand", label: "Brand Resources" },
] as const;

const FOOTER_META = ["News", "Settings", "2026 peaksees Corp."] as const;

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={
        "border-t border-zinc-300/80 bg-white/55 px-4 py-3 text-center text-[11px] text-zinc-500 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/45 dark:text-zinc-400 " +
        className
      }
    >
      <nav
        aria-label="Footer links"
        className="mx-auto flex max-w-6xl items-center justify-start gap-0 overflow-x-auto whitespace-nowrap pb-1 sm:justify-center"
      >
        {FOOTER_LINKS.map((item, index) => (
          <div key={item.href} className="inline-flex items-center">
            {index > 0 ? (
              <span aria-hidden className="px-2 text-zinc-400 dark:text-zinc-600">
                |
              </span>
            ) : null}
            <Link
              href={item.href}
              className="transition hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
            >
              {item.label}
            </Link>
          </div>
        ))}
      </nav>
      <div className="mx-auto mt-1 flex max-w-6xl items-center justify-start gap-0 overflow-x-auto whitespace-nowrap sm:justify-center">
        {FOOTER_META.map((item, index) => (
          <div key={item} className="inline-flex items-center">
            {index > 0 ? (
              <span aria-hidden className="px-2 text-zinc-400 dark:text-zinc-600">
                |
              </span>
            ) : null}
            <span>{item}</span>
          </div>
        ))}
      </div>
    </footer>
  );
}
