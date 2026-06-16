import Link from "next/link";
import { redirect } from "next/navigation";

import { PeakAnimeClient } from "@/app/components/anime/PeakAnimeClient";
import { BackButton } from "@/app/components/BackButton";
import { getSession } from "@/lib/auth/session";

export default async function PeakAnimePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="min-h-dvh bg-gradient-to-b from-zinc-100 to-zinc-200/90 px-4 py-8 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center gap-2">
          <BackButton fallbackHref="/feed" iconOnly />
          <Link
            href="/feed"
            className="text-sm font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
          >
            Back to feed
          </Link>
        </header>
        <PeakAnimeClient memberPlan={session.user.memberPlan} />
      </div>
    </main>
  );
}
