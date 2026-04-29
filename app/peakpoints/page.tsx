import Link from "next/link";
import { redirect } from "next/navigation";

import { BackButton } from "@/app/components/BackButton";
import { LogoutButton } from "@/app/components/LogoutButton";
import { PeakpointsClient } from "@/app/peakpoints/PeakpointsClient";
import { getSession } from "@/lib/auth/session";

export default async function PeakpointsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-dvh bg-gradient-to-b from-zinc-100 to-zinc-200/90 px-4 py-8 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BackButton fallbackHref="/feed" iconOnly />
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Peakpoints
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
            >
              Dashboard
            </Link>
            <LogoutButton />
          </div>
        </header>

        <PeakpointsClient />
      </div>
    </div>
  );
}

