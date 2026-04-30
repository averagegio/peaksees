import { NextResponse } from "next/server";

import { getMailer, getMailerMissingEnv } from "@/lib/email/mailer";

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
    const missing = getMailerMissingEnv();
    const detail =
      missing.length > 0
        ? ` Add: ${missing.map((m) => m.key).join(", ")}.`
        : " Check SMTP_PORT (default 587) and that EMAIL_FROM / ADVERTISERS_TO_EMAIL resolve (they default to SMTP_USER).";
    return NextResponse.json(
      {
        error:
          "Email is not configured on the server." +
          detail +
          " Zoho US example: SMTP_HOST=smtp.zoho.com, SMTP_PORT=587, SMTP_USER=you@yourdomain.com, SMTP_PASS=your app password.",
        missing: missing.map((m) => m.key),
      },
      { status: 503 },
    );
  }

  try {
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
  } catch (e) {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as { message?: string }).message)
        : "SMTP send failed";
    console.error("[advertisers] sendMail:", e);
    return NextResponse.json(
      {
        error:
          "Could not deliver email. Verify SMTP_HOST, SMTP_PORT (465 SSL vs 587 TLS), SMTP_USER, SMTP_PASS, and that the sender is allowed for your provider.",
        detail: process.env.NODE_ENV === "development" ? msg : undefined,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

