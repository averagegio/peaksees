import Link from "next/link";

type InfoPageProps = {
  title: string;
  body: string;
};

export default function InfoPage({ title, body }: InfoPageProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-100 px-4 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="w-full max-w-2xl rounded-2xl border border-zinc-300/80 bg-white p-6 shadow-lg shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20 sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
          {body}
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/"
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Back home
          </Link>
          <Link
            href="/feed"
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Open feed
          </Link>
        </div>
      </section>
    </main>
  );
}
