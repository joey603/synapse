import Link from "next/link";
import { cookies } from "next/headers";

import { BackChevron } from "@/components/ui/BackChevron";
import { EmptyState } from "@/components/ui/EmptyState";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { visitTypeLabel } from "@/lib/clinical/templates";
import { db, join } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export default async function TransmissionsPage() {
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const reports = await db.clinicalReport.findMany({
    where: { status: { in: ["AI_GENERATED", "REVIEWED"] } },
    orderBy: { visit: { occurredAt: "desc" } },
    ...join,
    include: { visit: { include: { patient: { select: { firstName: true, lastName: true } } } } },
  });

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/"
        className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted"
      >
        <BackChevron locale={locale} />
        {t(locale, "home")}
      </Link>
      <header>
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "transmissionsTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t(locale, "rowPendingHint")}</p>
      </header>
      {reports.length === 0 ? (
        <EmptyState title={t(locale, "transmissionsEmpty")} body={t(locale, "transmissionsHint")} />
      ) : (
        <SurfaceCard>
          {reports.map((report, index) => {
            const date = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
              timeZone: "Asia/Jerusalem",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(report.visit.occurredAt);
            const preview = excerpt(report.editedDraft ?? report.aiDraft ?? "");

            return (
              <div key={report.id}>
                {index > 0 ? <div className="border-t border-line/70" /> : null}
                <Link
                  href={`/patients/${report.visit.patientId}/visits/${report.visitId}?tab=report`}
                  className="flex min-h-[4.5rem] flex-col gap-2 px-4 py-3 active:bg-surface/70"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-ink">
                        {report.visit.patient.firstName} {report.visit.patient.lastName}
                      </span>
                      <span className="block text-sm text-muted">
                        {t(locale, visitTypeLabel(report.visit.type))} · {date}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-medium text-danger">
                      {t(locale, "reportPending")}
                    </span>
                  </span>
                  {preview ? (
                    <span dir="rtl" className="line-clamp-2 text-right text-sm leading-6 text-ink">
                      {preview}
                    </span>
                  ) : null}
                </Link>
              </div>
            );
          })}
        </SurfaceCard>
      )}
    </div>
  );
}

function excerpt(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 160) return clean;
  return `${clean.slice(0, 157)}…`;
}
