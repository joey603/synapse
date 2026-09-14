import Link from "next/link";
import { cookies } from "next/headers";

import { EmptyState } from "@/components/ui/EmptyState";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { visitTypeLabel } from "@/lib/clinical/templates";
import { db } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export default async function RecentVisitsPage() {
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const visits = await db.visit.findMany({
    where: { occurredAt: { lte: new Date() } },
    take: 40,
    orderBy: { occurredAt: "desc" },
    include: { patient: true, report: true },
  });

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/"
        className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <path
            d="M14.5 7.5 10 12l4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {t(locale, "home")}
      </Link>
      <header>
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "recentTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t(locale, "rowRecentHint")}</p>
      </header>
      {visits.length === 0 ? (
        <EmptyState title={t(locale, "recentEmpty")} body={t(locale, "recentHint")} />
      ) : (
        <SurfaceCard>
          {visits.map((visit, index) => {
            const date = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
              timeZone: "Asia/Jerusalem",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(visit.occurredAt);

            return (
              <div key={visit.id}>
                {index > 0 ? <div className="border-t border-line/70" /> : null}
                <Link
                  href={`/patients/${visit.patientId}/visits/${visit.id}`}
                  className="flex min-h-[4.5rem] items-center justify-between gap-3 px-4 py-3 active:bg-surface/70"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink">
                      {visit.patient.firstName} {visit.patient.lastName}
                    </p>
                    <p className="text-sm text-muted">
                      {t(locale, visitTypeLabel(visit.type))} · {date}
                    </p>
                  </div>
                  {visit.report?.status === "AI_GENERATED" || visit.report?.status === "REVIEWED" ? (
                    <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                      {t(locale, "reportPending")}
                    </span>
                  ) : visit.report?.status === "DRAFT" ? (
                    <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">
                      {t(locale, "visitDraft")}
                    </span>
                  ) : visit.report?.status === "VALIDATED" ? (
                    <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                      {t(locale, "reportValidated")}
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
