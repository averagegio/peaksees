import "server-only";

import nodemailer from "nodemailer";

export type MailerMissing = { key: string; hint: string }[];

/** Returns which SMTP-related env vars are still required (for error messages). */
export function getMailerMissingEnv(): MailerMissing {
  const host = (process.env.SMTP_HOST ?? "").trim();
  const user = (process.env.SMTP_USER ?? "").trim();
  const pass = (process.env.SMTP_PASS ?? "").trim();
  const missing: MailerMissing = [];
  if (!host) {
    missing.push({
      key: "SMTP_HOST",
      hint:
        "Use the outgoing SMTP server your provider lists for your account (Zoho domain/org mail often uses smtppro.zoho.com; personal @zohomail.com uses smtp.zoho.com — EU/other regions may differ; check Zoho Mail → SMTP / server configuration).",
    });
  }
  if (!user) {
    missing.push({
      key: "SMTP_USER",
      hint: "usually your full mailbox email address",
    });
  }
  if (!pass) {
    missing.push({
      key: "SMTP_PASS",
      hint: "app password / SMTP password (not always your normal login)",
    });
  }
  return missing;
}

/**
 * Nodemailer transporter when SMTP is fully configured.
 * Defaults: port 587 (STARTTLS), `EMAIL_FROM` → SMTP_USER, `ADVERTISERS_TO_EMAIL` → SMTP_USER.
 */
export function getMailer() {
  const host = (process.env.SMTP_HOST ?? "").trim();
  const portEnv = (process.env.SMTP_PORT ?? "").trim();
  const port = portEnv ? Number(portEnv) : 587;
  const user = (process.env.SMTP_USER ?? "").trim();
  const pass = (process.env.SMTP_PASS ?? "").trim();
  const from = (process.env.EMAIL_FROM ?? "").trim() || user;
  const to = (process.env.ADVERTISERS_TO_EMAIL ?? "").trim() || user;

  if (!host || !user || !pass) {
    return null;
  }
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    return null;
  }
  if (!from || !to) {
    return null;
  }

  const secureExplicit = (process.env.SMTP_SECURE ?? "").trim().toLowerCase();
  const secure =
    secureExplicit === "true" || secureExplicit === "1"
      ? true
      : secureExplicit === "false" || secureExplicit === "0"
        ? false
        : port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 25_000,
    greetingTimeout: 20_000,
    socketTimeout: 25_000,
    tls: {
      minVersion: "TLSv1.2",
    },
    ...(port === 587 && !secure
      ? {
          requireTLS: true,
        }
      : {}),
  });

  return { transporter, from, to };
}
