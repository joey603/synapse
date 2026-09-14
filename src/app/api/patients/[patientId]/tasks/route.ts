import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT"] as const;

export async function POST(request: Request, context: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await context.params;
  const form = await request.formData();
  const back = safeNext(form.get("next"), patientId);
  if (!isSameOrigin(request)) return NextResponse.redirect(appUrl(request, back), 303);

  const session = await getSession();
  if (session.status === "invalid") return NextResponse.redirect(appUrl(request, "/api/auth/clear"), 303);
  if (session.status !== "ok") return NextResponse.redirect(appUrl(request, "/login"), 303);

  const title = typeof form.get("title") === "string" ? form.get("title")!.toString().trim().slice(0, 160) : "";
  const visitId = typeof form.get("visitId") === "string" && form.get("visitId")!.toString().length > 0 ? form.get("visitId")!.toString() : null;
  const priority = PRIORITIES.includes(form.get("priority") as (typeof PRIORITIES)[number])
    ? (form.get("priority") as (typeof PRIORITIES)[number])
    : "NORMAL";
  const dueRaw = form.get("dueDate");
  const dueDate = typeof dueRaw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? new Date(`${dueRaw}T12:00:00.000Z`) : null;
  if (!title) return NextResponse.redirect(appUrl(request, back), 303);

  const linked = visitId
    ? await db.visit.findFirst({ where: { id: visitId, patientId }, select: { id: true } })
    : null;
  const task = await db.task.create({
    data: { patientId, visitId: linked?.id, title, priority, dueDate, status: "TODO" },
    select: { id: true },
  });
  await audit({
    actorId: session.user.id,
    action: "TASK_CREATED",
    entityType: "Task",
    entityId: task.id,
    patientId,
    metadata: { priority },
  });
  return NextResponse.redirect(appUrl(request, back), 303);
}

function safeNext(value: FormDataEntryValue | null, patientId: string) {
  const fallback = `/patients/${patientId}?tab=timeline&filter=tasks`;
  if (typeof value !== "string" || !value.startsWith(`/patients/${patientId}`)) return fallback;
  if (value.includes("://") || value.startsWith("//")) return fallback;
  return value;
}
