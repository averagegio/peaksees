/**
 * Map nodemailer / SMTP failures to short, safe hints for the API client.
 */
export function getSmtpDeliveryHint(err: unknown): string {
  const raw =
    err && typeof err === "object" && "message" in err
      ? String((err as Error).message)
      : String(err);
  const response =
    err && typeof err === "object" && "response" in err
      ? String((err as { response?: string }).response ?? "")
      : "";
  const combined = `${raw} ${response}`.toLowerCase();

  if (/535|authentication failed|invalid login|auth|535 5\.7\.8|535 5\.0\.0/i.test(combined)) {
    return "Authentication failed: use your provider’s SMTP / app password (often not your normal web login). Confirm SMTP_USER is the full email address.";
  }
  if (/sender|from address|not allowed|relay|550 5\.1\.|553 5\.1\.|mail from/i.test(combined)) {
    return "Sender rejected: set EMAIL_FROM to the same mailbox you use for SMTP_USER (or a verified alias in your mail provider).";
  }
  if (/timeout|etimedout|econnreset|connection closed|greeting|socket/i.test(combined)) {
    return "Connection issue: try SMTP_PORT=465 (SSL) instead of 587, or confirm SMTP_HOST and that outbound SMTP is allowed for your account.";
  }
  if (/certificate|self signed|unable to verify|ssl|tls|wrong version|alert/i.test(combined)) {
    return "TLS issue: try SMTP_PORT=465 with SSL, or 587 with STARTTLS—match what your provider’s docs specify for “third-party clients.”";
  }
  if (/spam|blocked|policy|rejected|denied|554|550 5\.7\./i.test(combined)) {
    return "Message rejected by provider: check spam policy, or send from a verified domain / allowed sender in your mail dashboard.";
  }
  return "Verify SMTP_HOST, SMTP_PORT (465 SSL vs 587 STARTTLS), SMTP_USER, SMTP_PASS, and that SMTP access is enabled for your mailbox.";
}
