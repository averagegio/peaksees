import Link from "next/link";

import {
  peakAiDeskReplyNeedsPeakflowCta,
  splitPeakAiReplyParts,
} from "@/lib/peak-ai/desk-chat";

export function PeakAiReplyBody({
  text,
  alreadyOnPeakflow = false,
}: {
  text: string;
  alreadyOnPeakflow?: boolean;
}) {
  const parts = splitPeakAiReplyParts(text);
  const showPeakflow = peakAiDeskReplyNeedsPeakflowCta(text, alreadyOnPeakflow);

  return (
    <div>
      <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">
        {parts.map((part, index) => {
          if (part === "/peakflow" || part === "/pricing") {
            return (
              <Link
                key={`${part}-${index}`}
                href={part}
                className="font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
              >
                {part === "/peakflow" ? "Open Peakflow" : "Upgrade to PeakPlus"}
              </Link>
            );
          }
          return <span key={`t-${index}`}>{part}</span>;
        })}
      </p>
      {showPeakflow ? (
        <Link
          href="/peakflow"
          className="mt-2 inline-flex text-xs font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
        >
          Open Peakflow
        </Link>
      ) : null}
    </div>
  );
}
