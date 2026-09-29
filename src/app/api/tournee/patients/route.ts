import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

function clip(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, max);
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "invalid" }, { status: 403 });
  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const name = clip(body.name, 160);
  const parts = name ? splitName(name) : null;
  if (!parts) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const city = clip(body.city, 80);
  const address = clip(body.address, 240);
  const phonesRaw = typeof body.phones === "string" ? body.phones : Array.isArray(body.phones) ? body.phones.join(",") : "";
  const phones = String(phonesRaw)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const homeQuota = Number(body.homeQuota);
  const phoneQuota = Number(body.phoneQuota);
  const notes = clip(body.notes, 2000);
  const endOfCare = parseDate(body.endOfCare);

  try {
    const patient = await db.patient.create({
      data: {
        firstName: parts.firstName,
        lastName: parts.lastName,
        city,
        address,
        phone: phones[0] ?? null,
        contactPhone: phones[1] ?? null,
        weeklyInPersonVisits: Number.isFinite(homeQuota) ? Math.max(0, Math.floor(homeQuota)) : null,
        weeklyVirtualVisits: Number.isFinite(phoneQuota) ? Math.max(0, Math.floor(phoneQuota)) : null,
        plannedDischargeDate: endOfCare,
        operationalNote: notes,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    await audit({
      actorId: session.user.id,
      action: "PATIENT_CREATED",
      entityType: "Patient",
      entityId: patient.id,
      patientId: patient.id,
    });
    return NextResponse.json({ ok: true, patientId: patient.id });
  } catch {
    logger.error("tournee.patient_create_failed");
    return NextResponse.json({ error: "save" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "invalid" }, { status: 403 });
  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const patientId = clip(body.patientId, 64);
  if (!patientId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const existing = await db.patient.findUnique({
    where: { id: patientId },
    select: { id: true, address: true, city: true },
  });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const parts = splitName(body.name);
    if (parts) {
      data.firstName = parts.firstName;
      data.lastName = parts.lastName;
    }
  }
  if ("city" in body) data.city = clip(body.city, 80);
  if ("address" in body) data.address = clip(body.address, 240);
  if ("notes" in body) data.operationalNote = clip(body.notes, 2000);
  if ("endOfCare" in body) {
    data.plannedDischargeDate = body.endOfCare ? parseDate(body.endOfCare) : null;
  }
  if ("homeQuota" in body) {
    const n = Number(body.homeQuota);
    data.weeklyInPersonVisits = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
  }
  if ("phoneQuota" in body) {
    const n = Number(body.phoneQuota);
    data.weeklyVirtualVisits = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
  }
  if ("phones" in body) {
    const phonesRaw = typeof body.phones === "string" ? body.phones : Array.isArray(body.phones) ? body.phones.join(",") : "";
    const phones = String(phonesRaw)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    data.phone = phones[0] ?? null;
    data.contactPhone = phones[1] ?? null;
  }

  const placeChanged =
    ("address" in data && data.address !== existing.address) || ("city" in data && data.city !== existing.city);
  if (placeChanged) {
    data.latitude = null;
    data.longitude = null;
    data.geoKey = null;
  }

  try {
    await db.patient.update({ where: { id: patientId }, data });
    await audit({
      actorId: session.user.id,
      action: "PATIENT_UPDATED",
      entityType: "Patient",
      entityId: patientId,
      patientId,
    });
    return NextResponse.json({ ok: true });
  } catch {
    logger.error("tournee.patient_update_failed");
    return NextResponse.json({ error: "save" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "invalid" }, { status: 403 });
  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  let body: { patientId?: string };
  try {
    body = (await request.json()) as { patientId?: string };
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const patientId = clip(body.patientId, 64);
  if (!patientId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const existing = await db.patient.findUnique({
    where: { id: patientId },
    select: { id: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await db.patient.update({
      where: { id: patientId },
      data: { status: "DISCHARGED" },
    });
    await audit({
      actorId: session.user.id,
      action: "PATIENT_UPDATED",
      entityType: "Patient",
      entityId: patientId,
      patientId,
      metadata: { status: "DISCHARGED", source: "tournee" },
    });
    return NextResponse.json({ ok: true });
  } catch {
    logger.error("tournee.patient_delete_failed");
    return NextResponse.json({ error: "save" }, { status: 500 });
  }
}
