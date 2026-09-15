import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { TaskInbox } from "@/components/tasks/TaskInbox";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { visitTypeLabel } from "@/lib/clinical/templates";
import { db, join } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export default async function RecentVisitsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab = "visits" } = await searchParams;
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const visits = await db.visit.findMany({
    where: { occurredAt: { lte: new Date() } },
    take: 40,
    orderBy: { occurredAt: "desc" },
    ...join,
    select: {
      id: true,
      type: true,
      occurredAt: true,
      patientId: true,
      patient: { select: { firstName: true, lastName: true } },
      report: { select: { status: true } },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "recentTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t(locale, "rowRecentHint")}</p>
      </header>
      <Suspense fallback={null}>
        <SegmentedControl
          scroll={false}
          activeId={tab === "tasks" ? "tasks" : "visits"}
          segments={[
            { id: "visits", label: t(locale, "filterVisits"), href: "/visits" },
            { id: "tasks", label: t(locale, "filterTasks"), href: "/visits?tab=tasks" },
          ]}
        />
      </Suspense>
      {tab === "tasks" ? <TaskInbox locale={locale} next="/visits?tab=tasks" /> : visits.length === 0 ? (
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
