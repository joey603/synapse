import { NextResponse } from "next/server";

import { getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { geocodePlace } from "@/lib/geo/nominatim";
import { placeKey } from "@/lib/geo/place";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const BATCH = 3;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "origin" }, { status: 403 });

  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  const patients = await db.patient.findMany({
    where: { status: "ACTIVE", OR: [{ address: { not: null } }, { city: { not: null } }] },
    select: { id: true, address: true, city: true, latitude: true, longitude: true, geoKey: true },
    take: 80,
    orderBy: { updatedAt: "desc" },
  });

  const pending = patients.filter((patient) => {
    const key = placeKey(patient.address, patient.city);
    return Boolean(key) && patient.geoKey !== key;
  });

  for (const [index, patient] of pending.slice(0, BATCH).entries()) {
    if (index > 0) await sleep(1100);
    const key = placeKey(patient.address, patient.city);
    if (!key) continue;
    try {
      const point = await geocodePlace(patient.address, patient.city);
      await db.patient.update({
        where: { id: patient.id },
        data: point
          ? { latitude: point.latitude, longitude: point.longitude, geoKey: key }
          : { latitude: null, longitude: null, geoKey: key },
      });
    } catch {
      logger.error("nearby.geocode_failed");
    }
  }

  const fresh = await db.patient.findMany({
    where: { status: "ACTIVE", OR: [{ address: { not: null } }, { city: { not: null } }] },
    select: { id: true, latitude: true, longitude: true, address: true, city: true, geoKey: true },
    take: 80,
  });
  const resolved = (patient: (typeof fresh)[number]) => patient.geoKey === placeKey(patient.address, patient.city);

  return NextResponse.json({
    located: fresh
      .filter((patient) => resolved(patient) && patient.latitude != null && patient.longitude != null)
      .map((patient) => ({
        id: patient.id,
        latitude: patient.latitude,
        longitude: patient.longitude,
      })),
    pending: fresh.filter((patient) => placeKey(patient.address, patient.city) && !resolved(patient)).length,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
