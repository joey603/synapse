import { NextResponse } from "next/server";

import { audit } from "@/lib/audit";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  const form = await request.formData();
  const next = form.get("next");
  const back = typeof next === "string" && next.startsWith("/patients/") && !next.includes("://") ? next : "/tasks";
  if (!isSameOrigin(request)) return NextResponse.redirect(appUrl(request, back), 303);

  const session = await getSession();
  if (session.status === "invalid") return NextResponse.redirect(appUrl(request, "/api/auth/clear"), 303);
  if (session.status !== "ok") return NextResponse.redirect(appUrl(request, "/login"), 303);

  const task = await db.task.findUnique({ where: { id: taskId }, select: { id: true, patientId: true, status: true } });
  if (task) {
    const done = task.status === "DONE";
    await db.task.update({
      where: { id: task.id },
      data: done ? { status: "TODO", completedAt: null } : { status: "DONE", completedAt: new Date() },
    });
    await audit({
      actorId: session.user.id,
      action: done ? "TASK_REOPENED" : "TASK_DONE",
      entityType: "Task",
      entityId: task.id,
      patientId: task.patientId,
    });
  }
  return NextResponse.redirect(appUrl(request, back), 303);
}
