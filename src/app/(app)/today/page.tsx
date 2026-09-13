import Link from "next/link";
import { cookies } from "next/headers";

import { EmptyState } from "@/components/ui/EmptyState";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { visitTypeLabel } from "@/lib/clinical/templates";
import { db } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";
import { formatJerusalemInput, jerusalemDayBounds } from "@/lib/visits/time";

export default async function TodayPage() {
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const { start, end } = jerusalemDayBounds();
  const visits = await db.visit.findMany({
    where: { occurredAt: { gte: start, lt: end } },
    orderBy: { occurredAt: "asc" },
    include: { patient: { select: { firstName: true, lastName: true, city: true } } },
  });

  const dateLabel = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "agendaToday")}</h1>
        <p className="mt-1 text-sm capitalize text-muted">{dateLabel}</p>
      </header>
      {visits.length === 0 ? (
        <EmptyState title={t(locale, "agendaEmpty")} body={t(locale, "actionTodayHint")} />
      ) : (
        <SurfaceCard>
          {visits.map((visit, index) => (
            <div key={visit.id}>
              {index > 0 ? <div className="border-t border-line/70" /> : null}
              <Link
                href={`/patients/${visit.patientId}/visits/${visit.id}`}
                className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 active:bg-surface/70"
              >
                <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-accent">
                  {formatJerusalemInput(visit.occurredAt).slice(11)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-ink">
                    {visit.patient.firstName} {visit.patient.lastName}
                  </span>
                  <span className="block truncate text-sm text-muted">
                    {t(locale, visitTypeLabel(visit.type))}
                    {visit.patient.city ? ` · ${visit.patient.city}` : ""}
                  </span>
                </span>
              </Link>
            </div>
          ))}
        </SurfaceCard>
      )}
    </div>
  );
}
