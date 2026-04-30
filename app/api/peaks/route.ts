import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { createPeak, listPeaks } from "@/lib/peaks/store";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const mine = url.searchParams.get("mine") === "1";
  const limit = Number(url.searchParams.get("limit") ?? "20");

  const peaks = await listPeaks({
    mineUserId: mine ? session.user.id : undefined,
    limit: Number.isFinite(limit) ? limit : 20,
  });
  return NextResponse.json({ peaks });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { text?: string; expiresAt?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (text.trim().length < 1) {
    return NextResponse.json({ error: "Post text required" }, { status: 400 });
  }

  const expiresAt =
    typeof body.expiresAt === "string" && body.expiresAt.trim()
      ? body.expiresAt
      : null;
  const peak = await createPeak({ userId: session.user.id, text, expiresAt });
  return NextResponse.json({ peak });
}
