import { NextResponse } from "next/server";

import { getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { haversineMeters } from "@/lib/geo/distance";
import { wazeDriveSeconds } from "@/lib/geo/waze";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const CONCURRENCY = 4;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "origin" }, { status: 403 });

  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    lat?: unknown;
    lng?: unknown;
    ids?: unknown;
  } | null;
  const from = point(body?.lat, body?.lng);
  if (!from) return NextResponse.json({ error: "coords" }, { status: 400 });

  const onlyIds = Array.isArray(body?.ids)
    ? new Set(body.ids.filter((id): id is string => typeof id === "string" && id.length > 0))
    : null;

  const patients = await db.patient.findMany({
    where: {
      status: "ACTIVE",
      latitude: { not: null },
      longitude: { not: null },
      ...(onlyIds && onlyIds.size > 0 ? { id: { in: [...onlyIds] } } : {}),
    },
    select: { id: true, latitude: true, longitude: true },
    orderBy: { updatedAt: "desc" },
  });

  const located = patients
    .flatMap((patient) => {
      if (patient.latitude == null || patient.longitude == null) return [];
      if (onlyIds && onlyIds.size > 0 && !onlyIds.has(patient.id)) return [];
      return [{
        id: patient.id,
        to: { lat: patient.latitude, lng: patient.longitude },
        meters: haversineMeters(from, { lat: patient.latitude, lng: patient.longitude }),
      }];
    })
    .sort((a, b) => a.meters - b.meters);

  const unique = new Map<string, { key: string; to: { lat: number; lng: number } }>();
  for (const patient of located) {
    const key = `${patient.to.lat.toFixed(5)},${patient.to.lng.toFixed(5)}`;
    if (!unique.has(key)) unique.set(key, { key, to: patient.to });
  }

  const groups = [...unique.values()];
  const groupTimes = new Map<string, number>();

  for (let index = 0; index < groups.length; index += CONCURRENCY) {
    const batch = groups.slice(index, index + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (group) => {
        try {
          const seconds = await wazeDriveSeconds(from, group.to);
          return seconds == null ? null : { key: group.key, seconds };
        } catch {
          return null;
        }
      }),
    );
    for (const result of results) {
      if (result) groupTimes.set(result.key, result.seconds);
    }
  }

  const times = located.flatMap((patient) => {
    const key = `${patient.to.lat.toFixed(5)},${patient.to.lng.toFixed(5)}`;
    const seconds = groupTimes.get(key);
    return seconds == null ? [] : [{ id: patient.id, seconds }];
  });

  if (times.length === 0 && located.length > 0) {
    logger.error("nearby.waze_eta_failed");
  }

  return NextResponse.json({
    times,
    missing: located
      .filter((patient) => !groupTimes.has(`${patient.to.lat.toFixed(5)},${patient.to.lng.toFixed(5)}`))
      .map((patient) => patient.id),
  });
}

function point(lat: unknown, lng: unknown) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 29 || latitude > 34 || longitude < 34 || longitude > 36.5) return null;
  return { lat: latitude, lng: longitude };
}
