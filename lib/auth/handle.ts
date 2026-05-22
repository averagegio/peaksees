/** Reserved handles (no @ prefix). Peak AI uses `peak`. */
export const RESERVED_HANDLES = new Set([
  "peak",
  "admin",
  "api",
  "feed",
  "login",
  "signup",
  "dashboard",
  "settings",
  "help",
  "support",
  "www",
]);

const HANDLE_RE = /^[a-z0-9_]{3,32}$/;

export function normalizeHandleInput(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@+/, "");
}

export function defaultHandleFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "trader").toLowerCase();
  let slug = local.replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (slug.length < 3) slug = `trader_${slug || "x"}`.slice(0, 32);
  if (slug.length > 32) slug = slug.slice(0, 32);
  if (RESERVED_HANDLES.has(slug)) slug = `${slug}_user`.slice(0, 32);
  return slug;
}

export function validateHandle(slug: string): { ok: true; handle: string } | { ok: false; message: string } {
  const h = normalizeHandleInput(slug);
  if (!HANDLE_RE.test(h)) {
    return {
      ok: false,
      message: "Handle must be 3–32 characters: lowercase letters, numbers, or underscores.",
    };
  }
  if (RESERVED_HANDLES.has(h)) {
    return { ok: false, message: "That handle is reserved." };
  }
  return { ok: true, handle: h };
}

export function formatAtHandle(handle: string): string {
  const h = normalizeHandleInput(handle);
  return h ? `@${h}` : "@trader";
}
