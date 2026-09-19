import { NextResponse } from "next/server";
import type { DrivingRiskStatus } from "@prisma/client";

import { audit } from "@/lib/audit";
import { getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const DRIVING: readonly DrivingRiskStatus[] = [
  "NOT_ASSESSED",
  "NO_RISK_IDENTIFIED",
  "POSSIBLE_RISK",
  "RISK_IDENTIFIED",
  "UNCLEAR",
];

type Body = {
  text?: unknown;
  durationMinutes?: unknown;
  patientStatusNote?: unknown;
  drivingRisk?: unknown;
  diagnosisNote?: unknown;
  mainProblems?: unknown;
  currentMedication?: unknown;
  interventionsProvided?: unknown;
  carePlan?: unknown;
};

export async function PATCH(request: Request, context: { params: Promise<{ visitId: string }> }) {
  return saveReport(request, context);
}

export async function POST(request: Request, context: { params: Promise<{ visitId: string }> }) {
  return saveReport(request, context);
}

async function saveReport(request: Request, context: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await context.params;
  const session = await getSession();
  if (session.status !== "ok") {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "origin" }, { status: 403 });
  }

  const report = await db.clinicalReport.findUnique({
    where: { visitId },
    select: {
      id: true,
      status: true,
      aiDraft: true,
      patientStatusNote: true,
      drivingRisk: true,
      diagnosisNote: true,
      mainProblems: true,
      currentMedication: true,
      interventionsProvided: true,
      carePlan: true,
      visit: { select: { patientId: true, durationMinutes: true } },
    },
  });
  if (!report || report.status === "VALIDATED" || report.status === "DRAFT") {
    return NextResponse.json({ error: "locked" }, { status: 409 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const data: Record<string, unknown> = {};
  let touched = false;

  if ("text" in body) {
    const text = typeof body.text === "string" ? body.text.slice(0, 12000) : null;
    if (text === null) return NextResponse.json({ error: "invalid" }, { status: 400 });
    data.editedDraft = text;
    touched = true;
  }

  for (const key of [
    "patientStatusNote",
    "diagnosisNote",
    "mainProblems",
    "currentMedication",
    "interventionsProvided",
    "carePlan",
  ] as const) {
    if (!(key in body)) continue;
    const value = body[key];
    if (value !== null && typeof value !== "string") {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    data[key] = typeof value === "string" ? value.slice(0, 8000) : null;
    touched = true;
  }

  if ("drivingRisk" in body) {
    const value = body.drivingRisk;
    if (typeof value !== "string" || !DRIVING.includes(value as DrivingRiskStatus)) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    data.drivingRisk = value;
    touched = true;
  }

  let durationMinutes: number | null | undefined;
  if ("durationMinutes" in body) {
    if (body.durationMinutes === null) {
      durationMinutes = null;
    } else {
      const n = Number(body.durationMinutes);
      if (!Number.isInteger(n) || n < 1 || n > 480) {
        return NextResponse.json({ error: "invalid" }, { status: 400 });
      }
      durationMinutes = n;
    }
    touched = true;
  }

  if (!touched) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const textChanged =
    typeof data.editedDraft === "string" && data.editedDraft !== (report.aiDraft ?? "");
  const structuredChanged =
    ("patientStatusNote" in data && data.patientStatusNote !== report.patientStatusNote) ||
    ("diagnosisNote" in data && data.diagnosisNote !== report.diagnosisNote) ||
    ("mainProblems" in data && data.mainProblems !== report.mainProblems) ||
    ("currentMedication" in data && data.currentMedication !== report.currentMedication) ||
    ("interventionsProvided" in data && data.interventionsProvided !== report.interventionsProvided) ||
    ("carePlan" in data && data.carePlan !== report.carePlan) ||
    ("drivingRisk" in data && data.drivingRisk !== report.drivingRisk) ||
    (durationMinutes !== undefined && durationMinutes !== report.visit.durationMinutes);

  const status = textChanged || structuredChanged ? "REVIEWED" : report.status;

  await db.$transaction(async (tx) => {
    await tx.clinicalReport.update({
      where: { id: report.id },
      data: { ...data, status },
    });
    if (durationMinutes !== undefined) {
      await tx.visit.update({
        where: { id: visitId },
        data: { durationMinutes },
      });
    }
  });

  if (status === "REVIEWED" && report.status !== "REVIEWED") {
    await audit({
      actorId: session.user.id,
      action: "REPORT_EDITED",
      entityType: "ClinicalReport",
      entityId: report.id,
      patientId: report.visit.patientId,
      visitId,
      metadata: { from: report.status, to: status },
    });
  }

  return NextResponse.json({ status });
}
