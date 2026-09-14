import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const KINDS = ["TREATMENT", "CLINICAL", "HOSPITALIZATION", "EXAM", "CONTACT", "OTHER"] as const;

export async function POST(request: Request, context: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await context.params;
  const back = `/patients/${patientId}?tab=timeline`;
  if (!isSameOrigin(request)) return NextResponse.redirect(appUrl(request, back), 303);

  const session = await getSession();
  if (session.status === "invalid") return NextResponse.redirect(appUrl(request, "/api/auth/clear"), 303);
  if (session.status !== "ok") return NextResponse.redirect(appUrl(request, "/login"), 303);

  const form = await request.formData();
  const title = clip(form.get("title"), 160);
  const kind = oneOf(form.get("kind"), KINDS);
  const occurredAt = parseDay(form.get("occurredAt"));
  if (!title || !kind || !occurredAt) return NextResponse.redirect(appUrl(request, back), 303);

  const event = await db.clinicalEvent.create({
    data: {
      patientId,
      kind,
      title,
      body: clip(form.get("body"), 1000),
      occurredAt,
    },
    select: { id: true },
  });
  await audit({
    actorId: session.user.id,
    action: "EVENT_CREATED",
    entityType: "ClinicalEvent",
    entityId: event.id,
    patientId,
    metadata: { kind },
  });
  return NextResponse.redirect(appUrl(request, back), 303);
}

function clip(value: FormDataEntryValue | null, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function oneOf<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[]): T | null {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : null;
}

function parseDay(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T12:00:00.000Z`);
}
