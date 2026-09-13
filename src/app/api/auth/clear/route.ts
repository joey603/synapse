import { NextResponse } from "next/server";

import { appUrl, clearSessionCookie, getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (session.status === "ok") {
    return NextResponse.redirect(appUrl(request, "/"), 303);
  }

  const response = NextResponse.redirect(appUrl(request, "/login"), 303);
  clearSessionCookie(response);
  return response;
}
