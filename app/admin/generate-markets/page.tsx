import { redirect } from "next/navigation";

import { BackButton } from "@/app/components/BackButton";
import { getSession } from "@/lib/auth/session";

import { GenerateMarketsClient } from "./GenerateMarketsClient";

export default async function GenerateMarketsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="min-h-dvh bg-gradient-to-b from-zinc-100 to-zinc-200/90 px-4 py-10 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 flex items-center gap-2">
          <BackButton fallbackHref="/feed" iconOnly />
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Generate markets
          </h1>
        </div>
        <GenerateMarketsClient />
      </div>
    </main>
  );
}

