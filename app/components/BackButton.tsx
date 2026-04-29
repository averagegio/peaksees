"use client";

import { useRouter } from "next/navigation";

export function BackButton({
  fallbackHref = "/",
  className = "",
  label = "Back",
  iconOnly = false,
}: {
  fallbackHref?: string;
  className?: string;
  label?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className={`inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 ${iconOnly ? "h-8 w-8 p-0" : "gap-1.5 px-2.5 py-1.5"} ${className}`}
      aria-label={label}
      title={label}
    >
      <span aria-hidden>←</span>
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
