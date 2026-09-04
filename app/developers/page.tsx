import Link from "next/link";
import InfoPage from "@/app/components/marketing/InfoPage";

export default function DevelopersPage() {
  return (
    <InfoPage
      title="Developers"
      body="Peaksees exposes two separate Unusual Whales MCP connections. The official hosted server is for Cursor and other agents. The Peaksees endpoint is the in-app desk used by Peakflow and /whales — they are not interchangeable."
    >
      <div className="mt-6 space-y-4 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Official Unusual Whales MCP (Cursor / agents)
          </h2>
          <p className="mt-2">
            Hosted by Unusual Whales at{" "}
            <a
              href="https://api.unusualwhales.com/api/mcp"
              className="underline-offset-2 hover:underline"
            >
              https://api.unusualwhales.com/api/mcp
            </a>
            . Project config is{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              .cursor/mcp.json
            </code>
            ; Cursor loads it automatically. Auth is{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              Authorization: Bearer
            </code>{" "}
            from{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              UNUSUAL_WHALES_API_KEY
            </code>
            . Setup example:{" "}
            <a
              href="https://unusualwhales.com/public-api/mcp#cursor"
              className="underline-offset-2 hover:underline"
            >
              unusualwhales.com/public-api/mcp#cursor
            </a>
            .
          </p>
        </section>
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Peaksees in-app MCP
          </h2>
          <p className="mt-2">
            JSON-RPC{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              tools/list
            </code>{" "}
            and{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              tools/call
            </code>{" "}
            at{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              /api/unusual-whales/mcp
            </code>{" "}
            for PeakPlus sessions, the owner personal desk, or Bearer{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              UW_MCP_TOKEN
            </code>
            . Dashboards at{" "}
            <Link href="/peakflow" className="underline-offset-2 hover:underline">
              /peakflow
            </Link>{" "}
            and{" "}
            <Link href="/whales" className="underline-offset-2 hover:underline">
              /whales
            </Link>{" "}
            call the same server-side client — the API key never ships to the
            browser.
          </p>
        </section>
      </div>
    </InfoPage>
  );
}
