"use client";

import Link from "next/link";
import { useCallback } from "react";

function shouldVibrate() {
  if (typeof navigator === "undefined") return false;
  // Desktop clicks can't do haptics; this keeps it mobile-first.
  const anyNav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  if (typeof anyNav.vibrate !== "function") return false;

  const touchPoints = (navigator.maxTouchPoints ?? 0) > 0;
  const coarse =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  return touchPoints || coarse;
}

export function ProfileLink({
  href,
  className,
  ariaLabel,
  children,
}: {
  href: string;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const onClick = useCallback(() => {
    if (!shouldVibrate()) return;
    try {
      const anyNav = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
      anyNav.vibrate?.(12);
    } catch {
      // ignore
    }
  }, []);

  return (
    <Link href={href} className={className} aria-label={ariaLabel} onClick={onClick}>
      {children}
    </Link>
  );
}

