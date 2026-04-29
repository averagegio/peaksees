import "server-only";

import nodemailer from "nodemailer";

export function getMailer() {
  const host = process.env.SMTP_HOST ?? "";
  const port = Number(process.env.SMTP_PORT ?? "0");
  const user = process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  const from = process.env.EMAIL_FROM ?? "";
  const to = process.env.ADVERTISERS_TO_EMAIL ?? "";

  if (!host || !port || !user || !pass || !from || !to) {
    return null;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return { transporter, from, to };
}

