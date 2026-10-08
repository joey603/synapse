import { NextResponse } from "next/server";

import { getSession, isSameOrigin } from "@/lib/auth/session";
import { googleDriveRoute } from "@/lib/geo/google-route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "origin" }, { status: 403 });

  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    fromLat?: unknown;
    fromLng?: unknown;
    toLat?: unknown;
    toLng?: unknown;
    locale?: unknown;
  } | null;

  const from = point(body?.fromLat, body?.fromLng);
  const to = point(body?.toLat, body?.toLng);
  if (!from || !to) return NextResponse.json({ error: "coords" }, { status: 400 });

  const languageCode = body?.locale === "he" ? "he" : "fr";
  const route = await googleDriveRoute(from, to, languageCode);
  if (!route) return NextResponse.json({ error: "route" }, { status: 502 });

  return NextResponse.json({
    durationSeconds: route.durationSeconds,
    distanceMeters: route.distanceMeters,
    path: route.path,
    steps: route.steps,
  });
}

function point(lat: unknown, lng: unknown) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 29 || latitude > 34 || longitude < 34 || longitude > 36.5) return null;
  return { lat: latitude, lng: longitude };
}
