import "server-only";

import { getSession } from "@/lib/auth/session";

export async function isAdminRequest(request: Request): Promise<boolean> {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  const auth = request.headers.get("authorization") ?? "";
  if (secret && auth === `Bearer ${secret}`) return true;

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.length === 0) return false;

  const session = await getSession();
  const email = session?.user.email?.toLowerCase?.() ?? "";
  return Boolean(email && adminEmails.includes(email));
}
