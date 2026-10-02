import { NextResponse } from "next/server";

import { getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { geocodePlace } from "@/lib/geo/nominatim";
import { placeKey } from "@/lib/geo/place";
import { wazeSnapDestination } from "@/lib/geo/waze";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Force le géocodage + accroche rue pour un patient (ignore le cache geoKey). */
export async function POST(
  request: Request,
  context: { params: Promise<{ patientId: string }> },
) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "origin" }, { status: 403 });

  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  const { patientId } = await context.params;
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    select: { id: true, address: true, city: true },
  });
  if (!patient) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const key = placeKey(patient.address, patient.city);
  if (!key) {
    return NextResponse.json({ error: "no_address", ok: false }, { status: 400 });
  }

  try {
    const point = await geocodePlace(patient.address, patient.city);
    if (!point) {
      await db.patient.update({
        where: { id: patient.id },
        data: { latitude: null, longitude: null, geoKey: key },
      });
      return NextResponse.json({ ok: false, error: "geocode" }, { status: 422 });
    }

    let latitude = point.latitude;
    let longitude = point.longitude;
    let snapped = false;

    try {
      const road = await wazeSnapDestination({ lat: latitude, lng: longitude });
      if (road) {
        latitude = road.lat;
        longitude = road.lng;
        snapped = true;
      }
    } catch {
      // Point Nominatim conservé si le snap échoue.
    }

    await db.patient.update({
      where: { id: patient.id },
      data: { latitude, longitude, geoKey: key },
    });

    return NextResponse.json({
      ok: true,
      latitude,
      longitude,
      snapped,
      address: patient.address,
      city: patient.city,
    });
  } catch {
    logger.error("patient.regeocode_failed");
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
