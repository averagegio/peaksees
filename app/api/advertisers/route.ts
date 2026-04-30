import { NextResponse } from "next/server";

import { getMailer, getMailerMissingEnv } from "@/lib/email/mailer";
import { getSmtpDeliveryHint } from "@/lib/email/smtp-errors";

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
          " Zoho examples: domain/organization mailbox → SMTP_HOST=smtppro.zoho.com; personal Zoho Mail → smtp.zoho.com (EU datacenter may use a different host — copy from Zoho Mail SMTP settings). Ports 465 SSL or 587 TLS. SMTP_USER=you@yourdomain.com, SMTP_PASS=app-specific password.",
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
    const hint = getSmtpDeliveryHint(e);
    console.error("[advertisers] sendMail:", e);
    return NextResponse.json(
      {
        error: `Could not deliver email. ${hint}`,
        hint,
        detail:
          process.env.NODE_ENV === "development" ||
          (process.env.SMTP_DEBUG ?? "").trim() === "1"
            ? msg
            : undefined,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}

