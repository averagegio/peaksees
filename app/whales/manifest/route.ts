import { NextResponse } from "next/server";

export function GET() {
  const manifest = {
    name: "Peak Flow",
    short_name: "Peak Flow",
    description: "Personal Unusual Whales desk for Peaksees.",
    start_url: "/whales",
    scope: "/whales",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090b",
    theme_color: "#059669",
    icons: [
      {
        src: "/whales/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/whales/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
