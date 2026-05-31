import Link from "next/link";

import { BackButton } from "@/app/components/BackButton";
import { PeakseesHeaderBanner } from "@/app/components/PeakseesHeaderBanner";

export function AuthPageHeader({ crumb }: { crumb: string }) {
  return (
    <header className="relative border-b border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
        <BackButton fallbackHref="/" iconOnly />
      </div>
      <div className="flex flex-col items-center px-4 py-5 text-center sm:py-6">
        <Link href="/" className="inline-flex justify-center">
          <PeakseesHeaderBanner
            alt="peaksees"
            width={560}
            height={170}
            className="h-auto w-full max-h-[80px] max-w-[280px] object-contain sm:max-h-[92px] sm:max-w-[320px]"
            priority
          />
        </Link>
        <p className="mt-3 text-lg font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">
          {crumb}
        </p>
      </div>
    </header>
  );
}
