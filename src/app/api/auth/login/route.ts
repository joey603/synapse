import { NextResponse } from "next/server";

import { appUrl, attachSessionCookie, attachUserCookie, isSameOrigin, loginWithPassword } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.redirect(appUrl(request, "/login?error=invalid"), 303);
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const result = await loginWithPassword(email, password);

  if (!result.ok) {
    return NextResponse.redirect(appUrl(request, `/login?error=${result.code}`), 303);
  }

  const response = NextResponse.redirect(appUrl(request, "/"), 303);
  attachSessionCookie(response, result.token);
  attachUserCookie(response, result.user, result.expires);
  return response;
}
