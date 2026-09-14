import { NextResponse } from "next/server";

import { getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { haversineMeters } from "@/lib/geo/distance";
import { wazeDriveSeconds } from "@/lib/geo/waze";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const LIMIT = 12;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "origin" }, { status: 403 });

  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { lat?: unknown; lng?: unknown } | null;
  const from = point(body?.lat, body?.lng);
  if (!from) return NextResponse.json({ error: "coords" }, { status: 400 });

  const patients = await db.patient.findMany({
    where: { status: "ACTIVE", latitude: { not: null }, longitude: { not: null } },
    select: { id: true, latitude: true, longitude: true },
    take: 80,
    orderBy: { updatedAt: "desc" },
  });

  const nearest = patients
    .flatMap((patient) => {
      if (patient.latitude == null || patient.longitude == null) return [];
      return [{
        id: patient.id,
        to: { lat: patient.latitude, lng: patient.longitude },
        meters: haversineMeters(from, { lat: patient.latitude, lng: patient.longitude }),
      }];
    })
    .sort((a, b) => a.meters - b.meters)
    .slice(0, LIMIT);

  const times = await Promise.all(
    nearest.map(async (patient) => {
      try {
        const seconds = await wazeDriveSeconds(from, patient.to);
        return seconds == null ? null : { id: patient.id, seconds };
      } catch {
        return null;
      }
    }),
  );

  if (times.every((item) => item == null) && nearest.length > 0) {
    logger.error("nearby.waze_eta_failed");
  }

  return NextResponse.json({ times: times.filter((item) => item != null) });
}

function point(lat: unknown, lng: unknown) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 29 || latitude > 34 || longitude < 34 || longitude > 36.5) return null;
  return { lat: latitude, lng: longitude };
}
