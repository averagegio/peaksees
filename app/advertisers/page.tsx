import { AdvertisersForm } from "@/app/advertisers/AdvertisersForm";
import { BackButton } from "@/app/components/BackButton";

export default function AdvertisersPage() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-zinc-100 to-zinc-200/90 px-4 py-10 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-8 flex items-center gap-2">
          <BackButton fallbackHref="/feed" iconOnly />
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Advertisers
          </h1>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Tell us what you’re trying to promote and we’ll get back to you.
          </p>
          <div className="mt-5">
            <AdvertisersForm />
          </div>
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
            This form emails our team once company email is configured.
          </p>
        </div>
      </div>
    </main>
  );
}

