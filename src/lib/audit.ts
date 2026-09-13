import "server-only";

import { db } from "@/lib/db";

const BLOCKED_KEY = /password|token|secret|transcript|dose|rawtext|audio/i;

type AuditValue = string | number | boolean | null;

export async function audit(entry: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  patientId?: string | null;
  visitId?: string | null;
  metadata?: Record<string, AuditValue>;
}) {
  const metadata = sanitize(entry.metadata);

  await db.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      patientId: entry.patientId ?? null,
      visitId: entry.visitId ?? null,
      metadata: metadata ?? undefined,
    },
  });
}

function sanitize(metadata: Record<string, AuditValue> | undefined) {
  if (!metadata) return null;

  const clean: Record<string, AuditValue> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (BLOCKED_KEY.test(key)) continue;
    clean[key] = value;
  }

  return Object.keys(clean).length > 0 ? clean : null;
}
