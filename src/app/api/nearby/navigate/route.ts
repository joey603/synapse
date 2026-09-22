import { NextResponse } from "next/server";

import { getSession, isSameOrigin } from "@/lib/auth/session";
import { wazeSnapDestination } from "@/lib/geo/waze";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "origin" }, { status: 403 });

  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    lat?: unknown;
    lng?: unknown;
    fromLat?: unknown;
    fromLng?: unknown;
  } | null;
  const to = point(body?.lat, body?.lng);
  if (!to) return NextResponse.json({ error: "coords" }, { status: 400 });
  const from = point(body?.fromLat, body?.fromLng);

  try {
    const snapped = await wazeSnapDestination(to, from);
    if (snapped) return NextResponse.json(snapped);
  } catch {
    logger.error("nearby.waze_snap_failed");
  }

  return NextResponse.json(to);
}

function point(lat: unknown, lng: unknown) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 29 || latitude > 34 || longitude < 34 || longitude > 36.5) return null;
  return { lat: latitude, lng: longitude };
}
