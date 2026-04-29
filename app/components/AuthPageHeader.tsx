import Image from "next/image";
import Link from "next/link";

import { BackButton } from "@/app/components/BackButton";
import { PEAKSEES_HEADER_BANNER } from "@/lib/brand";

export function AuthPageHeader({ crumb }: { crumb: string }) {
  return (
    <header className="border-b border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl items-center px-4 pt-3">
        <BackButton fallbackHref="/" iconOnly />
      </div>
      <Link href="/" className="flex flex-col items-center gap-3 px-4 py-3 sm:flex-row sm:justify-center sm:gap-6 sm:py-4">
        <Image
          src={PEAKSEES_HEADER_BANNER}
          alt="peaksees"
          width={560}
          height={170}
          className="h-auto w-full max-h-[88px] max-w-md object-contain sm:max-h-[100px]"
          priority
        />
        <span className="hidden text-lg font-semibold tracking-tight text-zinc-600 sm:inline dark:text-zinc-400">
          /
        </span>
        <span className="text-base font-semibold tracking-tight text-zinc-600 dark:text-zinc-400 sm:text-lg">
          {crumb}
        </span>
      </Link>
    </header>
  );
}


