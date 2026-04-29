import { NextResponse } from "next/server";

import { getMailer } from "@/lib/email/mailer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: { name?: string; email?: string; description?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 120) : "";
  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 2000) : "";

  if (!name || !EMAIL_RE.test(email) || description.length < 10) {
    return NextResponse.json(
      { error: "Name, valid email, and description are required." },
      { status: 400 },
    );
  }

  const mailer = getMailer();
  if (!mailer) {
    return NextResponse.json(
      { error: "Email is not configured yet." },
      { status: 503 },
    );
  }

  await mailer.transporter.sendMail({
    from: mailer.from,
    to: mailer.to,
    replyTo: email,
    subject: `peaksees advertiser inquiry — ${name}`,
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      "",
      "Description:",
      description,
    ].join("\n"),
  });

  return NextResponse.json({ ok: true });
}

