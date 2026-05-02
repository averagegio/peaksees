import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native addon; must not be bundled for Vercel serverless.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
