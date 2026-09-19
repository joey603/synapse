import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/constants";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

function isPublicAsset(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname === "/manifest.webmanifest" || pathname === "/manifest.json") return true;
  if (pathname === "/favicon.ico" || pathname === "/icon" || pathname === "/icon.png") return true;
  if (pathname === "/apple-icon" || pathname === "/apple-icon.png") return true;
  if (pathname.startsWith("/icons/")) return true;
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const hasSession = Boolean(sessionToken);

  if (!hasSession && !isPublicAsset(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next();

  // Prolonge le cookie à chaque visite pour éviter une déconnexion Safari/iOS.
  if (sessionToken && !pathname.startsWith("/api/auth/logout") && !pathname.startsWith("/api/auth/clear")) {
    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};
