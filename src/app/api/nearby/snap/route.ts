import { NextResponse } from "next/server";

import { getSession, isSameOrigin } from "@/lib/auth/session";
import { nearestRoad } from "@/lib/geo/osrm";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "origin" }, { status: 403 });

  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { lat?: unknown; lng?: unknown } | null;
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "coords" }, { status: 400 });
  }

  try {
    const snapped = await nearestRoad({ lat, lng });
    return NextResponse.json(snapped);
  } catch {
    logger.error("nearby.snap_failed");
    return NextResponse.json({ lat, lng, name: null });
  }
}
