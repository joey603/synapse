import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/constants";

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
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession && !isPublicAsset(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};
