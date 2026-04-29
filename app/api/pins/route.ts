import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { listPins, togglePin } from "@/lib/social/pins-store";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pins = await listPins(session.user.id);
  return NextResponse.json({ pins });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { postKey?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const postKey = typeof body.postKey === "string" ? body.postKey : "";
  if (!postKey) return NextResponse.json({ error: "postKey required" }, { status: 400 });

  const outcome = await togglePin({ userId: session.user.id, postKey });
  return NextResponse.json(outcome);
}

