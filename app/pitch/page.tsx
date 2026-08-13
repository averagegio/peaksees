import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";

import { PitchDeck } from "@/app/pitch/PitchDeck";
import "@/app/pitch/pitch.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-pitch-display",
  weight: ["500", "600", "700"],
});

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-pitch-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "peaksees — investor pitch deck",
  description:
    "TAM, MAU, sales funnel, market depth, Peakpoints, withdrawals, and funding from pre-seed to Series M.",
};

export default function PitchPage() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <PitchDeck />
    </div>
  );
}
