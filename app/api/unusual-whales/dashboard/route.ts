import { NextResponse } from "next/server";

import { requireDeskAccess } from "@/lib/unusual-whales/access";
import { fetchDashboardSnapshot } from "@/lib/unusual-whales/client";
import type { UnusualWhalesDesk } from "@/lib/unusual-whales/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deskParam = url.searchParams.get("desk");
  const desk: UnusualWhalesDesk = deskParam === "personal" ? "personal" : "subscriber";
  const access = await requireDeskAccess(desk);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error, code: access.code },
      { status: access.status },
    );
  }

  const snapshot = await fetchDashboardSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "private, max-age=20",
    },
  });
}
