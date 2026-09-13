import { NextResponse } from "next/server";

import { appUrl, clearSessionCookie, destroyCurrentSession, isSameOrigin } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.redirect(appUrl(request, "/login"), 303);
  }

  await destroyCurrentSession();
  const response = NextResponse.redirect(appUrl(request, "/login"), 303);
  clearSessionCookie(response);
  return response;
}
