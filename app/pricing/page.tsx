import Link from "next/link";

import { BackButton } from "@/app/components/BackButton";

function PriceCard({
  title,
  price,
  features,
  cta,
  plan,
  highlight = false,
}: {
  title: string;
  price: string;
  features: string[];
  cta: string;
  plan: "peakplus" | "peakpro" | "peakenterprise";
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border bg-white p-6 shadow-sm dark:bg-zinc-950 " +
        (highlight
          ? "border-emerald-500/40 ring-2 ring-emerald-500/15 dark:border-emerald-500/35"
          : "border-zinc-200 dark:border-zinc-800")
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        {highlight ? (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Best value
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
        {price}
        <span className="ml-1 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          /mo
        </span>
      </p>
      <ul className="mt-5 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span className="mt-0.5 text-emerald-600 dark:text-emerald-400">
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <form action="/api/stripe/checkout" method="post" className="mt-6">
        <input type="hidden" name="kind" value="subscription" />
        <input type="hidden" name="plan" value={plan} />
        <button
          type="submit"
          className={
            "w-full rounded-xl px-4 py-3 text-sm font-semibold transition " +
            (highlight
              ? "bg-emerald-600 text-white hover:bg-emerald-500"
              : "border border-zinc-300 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900")
          }
        >
          {cta}
        </button>
      </form>
    </div>
  );
}

export default function PricingPage() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-zinc-100 to-zinc-200/90 px-4 py-10 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-10 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <BackButton fallbackHref="/feed" iconOnly />
            <Link
              href="/feed"
              className="text-sm font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
            >
              Back to feed
            </Link>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
              Peak member subscriptions
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-300">
              Upgrade to unlock deeper market tools, live features, and priority
              access to Peak.
            </p>
          </div>
        </header>

        <section className="grid gap-5 md:grid-cols-3">
          <PriceCard
            title="PeakPlus"
            price="$10"
            plan="peakplus"
            cta="Choose PeakPlus"
            features={[
              "Priority @peak replies",
              "Enhanced feed filters",
              "Early access to new market types",
            ]}
          />
          <PriceCard
            title="PeakPro"
            price="$30"
            plan="peakpro"
            cta="Choose PeakPro"
            highlight
            features={[
              "Everything in PeakPlus",
              "Live creator tools + analytics",
              "Higher Peakpoints limits",
              "Faster Peak response time",
            ]}
          />
          <PriceCard
            title="PeakEnterprise"
            price="$50"
            plan="peakenterprise"
            cta="Choose PeakEnterprise"
            features={[
              "Everything in PeakPro",
              "Team dashboards",
              "Advanced moderation controls",
              "SLA support (email)",
            ]}
          />
        </section>
      </div>
    </main>
  );
}

