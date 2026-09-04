import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Peak Flow",
  description: "Personal Unusual Whales desk for Peaksees.",
  applicationName: "Peak Flow",
  manifest: "/whales/manifest",
  appleWebApp: {
    capable: true,
    title: "Peak Flow",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/whales/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/whales/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/whales/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function WhalesLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-zinc-950 text-zinc-50">{children}</div>;
}
