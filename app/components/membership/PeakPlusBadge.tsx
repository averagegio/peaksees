import type { MemberPlan } from "@/lib/membership/plans";

function planBadgeLabel(plan: MemberPlan): string | null {
  if (plan === "peakplus") return "Plus";
  if (plan === "peakpro") return "Pro";
  if (plan === "peakenterprise") return "Ent";
  return null;
}

export function PeakPlusBadge({
  plan,
  className = "",
}: {
  plan?: MemberPlan | null;
  className?: string;
}) {
  const label = plan ? planBadgeLabel(plan) : null;
  if (!label) return null;

  return (
    <span
      className={
        "inline-flex shrink-0 items-center rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700 ring-1 ring-violet-500/25 dark:bg-violet-500/20 dark:text-violet-200 dark:ring-violet-400/30 " +
        className
      }
      title={`${label === "Plus" ? "PeakPlus" : label === "Pro" ? "PeakPro" : "PeakEnterprise"} member`}
    >
      {label}
    </span>
  );
}
