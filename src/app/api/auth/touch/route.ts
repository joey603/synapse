import { NextResponse } from "next/server";

import {
  attachSessionCookie,
  attachUserCookie,
  isSameOrigin,
  touchCurrentSession,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return new NextResponse(null, { status: 403 });
  }

  const touched = await touchCurrentSession();
  if (!touched.ok) {
    return new NextResponse(null, { status: 401 });
  }

  const response = new NextResponse(null, { status: 204 });
  attachSessionCookie(response, touched.token);
  attachUserCookie(response, touched.user, touched.expires);
  return response;
}
