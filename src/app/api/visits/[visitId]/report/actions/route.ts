import { NextResponse } from "next/server";

import { getClinicalProvider, providerName } from "@/lib/ai/factory";
import { audit } from "@/lib/audit";
import { appUrl, getSession, isSameOrigin } from "@/lib/auth/session";
import { composeReport } from "@/lib/clinical/compose-report";
import { scrubForbidden } from "@/lib/clinical/forbidden-phrases";
import { parseStored } from "@/lib/clinical/schema";
import { composeStructuredSections } from "@/lib/clinical/structured-report";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { PROMPT_VERSION } from "../../../../../../../prompts/nursing-report-he";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await context.params;
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    include: {
      report: true,
      extraction: true,
      patient: { include: { medications: { where: { active: true }, orderBy: { name: "asc" } } } },
    },
  });
  const back = visit ? `/patients/${visit.patientId}/visits/${visit.id}?tab=report` : "/patients";
  if (!isSameOrigin(request)) return NextResponse.redirect(appUrl(request, back), 303);

  const session = await getSession();
  if (session.status !== "ok") return NextResponse.redirect(appUrl(request, "/login"), 303);
  if (!visit?.report || !visit.extraction) return NextResponse.redirect(appUrl(request, back), 303);
  if (visit.report.status === "VALIDATED" || visit.report.status === "DRAFT") {
    return NextResponse.redirect(appUrl(request, back), 303);
  }

  const form = await request.formData();
  const action = String(form.get("action") ?? "");
  const extraction = parseStored(visit.extraction.payload);
  if (!extraction) return NextResponse.redirect(appUrl(request, `${back}&pipe=generation_failed`), 303);

  try {
    const previous = visit.report.editedDraft ?? "";
    let text = previous;
    if (action === "regenerate") {
      text = scrubForbidden(
        composeReport({
          extraction,
          visitType: visit.type,
          occurredAt: visit.occurredAt,
          patientName: `${visit.patient.firstName} ${visit.patient.lastName}`,
        }),
        extraction,
      ).text;
      if (providerName() === "openai") {
        text = (await getClinicalProvider().generateReport({
          extraction,
          visitType: visit.type,
          occurredAt: visit.occurredAt,
          patientName: `${visit.patient.firstName} ${visit.patient.lastName}`,
        })).text;
      }
    } else if (action === "shorten" || action === "more_clinical" || action === "correct_hebrew") {
      text = (await getClinicalProvider().rewrite({ text: previous, action, extraction })).text;
    } else {
      return NextResponse.redirect(appUrl(request, back), 303);
    }

    if (!text.trim()) throw new Error("empty");
    const reviewed = action !== "regenerate";
    const structured =
      action === "regenerate"
        ? composeStructuredSections({
            extraction,
            visitType: visit.type,
            diagnosis: {
              primary: visit.patient.primaryDiagnosis,
              secondary: visit.patient.secondaryDiagnoses,
            },
            medications: visit.patient.medications,
          })
        : null;
    await db.clinicalReport.update({
      where: { id: visit.report.id },
      data: reviewed
        ? { editedDraft: text, status: "REVIEWED", promptVersion: PROMPT_VERSION }
        : {
            aiDraft: text,
            editedDraft: text,
            status: "AI_GENERATED",
            finalText: null,
            promptVersion: PROMPT_VERSION,
            ...(structured ?? {}),
          },
    });
    await audit({
      actorId: session.user.id,
      action: "REPORT_ACTION",
      entityType: "ClinicalReport",
      entityId: visit.report.id,
      patientId: visit.patientId,
      visitId: visit.id,
      metadata: { action },
    });
    return NextResponse.redirect(appUrl(request, back), 303);
  } catch {
    logger.error("report.action_failed");
    return NextResponse.redirect(appUrl(request, `${back}&pipe=generation_failed`), 303);
  }
}
