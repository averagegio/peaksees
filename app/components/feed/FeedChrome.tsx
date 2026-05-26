import { PeakComposerDock } from "@/app/components/composer/PeakComposerDock";
import { InteractiveFeedTour } from "@/app/components/tour/InteractiveFeedTour";
import { NavShell } from "@/app/components/nav/NavShell";
import { getSession } from "@/lib/auth/session";

export async function FeedChrome({
  children,
  showBackButton = true,
  interactiveFeedTour = false,
}: {
  children: React.ReactNode;
  showBackButton?: boolean;
  /** Spotlight tour on first visit (per browser); feed page only recommended. */
  interactiveFeedTour?: boolean;
}) {
  const session = await getSession();

  return (
    <div className="flex h-dvh overflow-hidden bg-gradient-to-b from-zinc-100 to-zinc-200/90 dark:from-zinc-950 dark:to-zinc-900">
      <NavShell session={session} showBackButton={showBackButton}>
        {children}
      </NavShell>
      <PeakComposerDock />
      {interactiveFeedTour && session ? (
        <InteractiveFeedTour
          userId={session.user.id}
          displayName={session.user.displayName}
          tourCompletedOnServer={session.user.interactiveFeedTourV1Completed}
        />
      ) : null}
    </div>
  );
}
