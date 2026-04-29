import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { createComment, listComments, toggleUpvote } from "@/lib/social/comments-store";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const postKey = url.searchParams.get("postKey") ?? "";
  if (!postKey) return NextResponse.json({ error: "postKey required" }, { status: 400 });

  const comments = await listComments({ postKey, viewerUserId: session.user.id });
  return NextResponse.json({ comments });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { postKey?: string; text?: string; action?: string; commentId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action === "upvote") {
    const commentId = typeof body.commentId === "string" ? body.commentId : "";
    if (!commentId) return NextResponse.json({ error: "commentId required" }, { status: 400 });
    await toggleUpvote({ commentId, userId: session.user.id });
    return NextResponse.json({ ok: true });
  }

  const postKey = typeof body.postKey === "string" ? body.postKey : "";
  const text = typeof body.text === "string" ? body.text : "";
  if (!postKey || !text.trim()) {
    return NextResponse.json({ error: "postKey and text required" }, { status: 400 });
  }

  await createComment({ postKey, userId: session.user.id, text });
  return NextResponse.json({ ok: true });
}

