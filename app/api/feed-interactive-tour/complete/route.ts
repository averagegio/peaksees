import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { markInteractiveFeedTourV1Completed } from "@/lib/auth/users-store";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await markInteractiveFeedTourV1Completed(session.user.id);
  return NextResponse.json({ ok: true });
}
