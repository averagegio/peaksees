import type { NextResponse } from "next/server";

import { UW_PERSONAL_COOKIE } from "./config";

const MONTH = 60 * 60 * 24 * 30;

export function attachPersonalDeskCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: UW_PERSONAL_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: MONTH,
  });
}

export function clearPersonalDeskCookie(response: NextResponse) {
  response.cookies.set({
    name: UW_PERSONAL_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}
