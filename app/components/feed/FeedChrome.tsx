import { NavShell } from "@/app/components/nav/NavShell";
import { PeakComposerDock } from "@/app/components/composer/PeakComposerDock";
import { getSession } from "@/lib/auth/session";

export async function FeedChrome({
  children,
  showBackButton = true,
}: {
  children: React.ReactNode;
  showBackButton?: boolean;
}) {
  const session = await getSession();

  return (
    <div className="flex h-dvh overflow-hidden bg-gradient-to-b from-zinc-100 to-zinc-200/90 dark:from-zinc-950 dark:to-zinc-900">
      <NavShell session={session} showBackButton={showBackButton}>
        {children}
      </NavShell>
      <PeakComposerDock />
    </div>
  );
}
