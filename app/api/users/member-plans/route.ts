import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { getMemberPlansForUserIds } from "@/lib/auth/users-store";

export const runtime = "nodejs";

/** Batch lookup paid tiers for profile badges (authenticated). */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const raw = url.searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 40);

  const plans = await getMemberPlansForUserIds(ids);
  return NextResponse.json({ plans });
}
