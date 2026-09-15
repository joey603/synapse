import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ patientId: string }> },
) {
  const session = await getSession();
  if (session.status !== "ok") return NextResponse.json({ error: "auth" }, { status: 401 });

  const { patientId } = await context.params;
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      phone: true,
      address: true,
      city: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!patient) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    id: patient.id,
    phone: patient.phone,
    address: patient.address,
    city: patient.city,
    latitude: patient.latitude,
    longitude: patient.longitude,
  });
}
