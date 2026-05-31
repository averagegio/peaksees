import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

loadEnvConfig(process.cwd());

/** Comma-separated LAN host(s) for phone preview, e.g. DEV_LAN_HOST=192.168.12.132 */
const devLanHosts = (process.env.DEV_LAN_HOST ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  // Native addon; must not be bundled for Vercel serverless.
  serverExternalPackages: ["better-sqlite3"],
  // Required for npm run dev:lan — without this, client JS is blocked on the LAN IP
  // and login/forms only work on localhost.
  ...(devLanHosts.length > 0 ? { allowedDevOrigins: devLanHosts } : {}),
  async headers() {
    return [
      {
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ];
  },
};

export default nextConfig;
