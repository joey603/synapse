import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ patientId: string }> }) {
  const session = await getSession();
  if (session.status !== "ok") {
    return new NextResponse(null, { status: 401 });
  }

  const { patientId } = await context.params;
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    select: { photoKey: true, photoMime: true },
  });
  if (!patient?.photoKey) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const stream = await getStorage().getStream(patient.photoKey);
    const web = Readable.toWeb(stream) as ReadableStream;
    return new NextResponse(web, {
      headers: {
        "Content-Type": patient.photoMime || "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
