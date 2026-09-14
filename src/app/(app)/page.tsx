import Link from "next/link";
import { cookies } from "next/headers";

import { ActionRow } from "@/components/ui/ActionRow";
import { QuickActionGrid } from "@/components/ui/QuickActionGrid";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { visitTypeLabel } from "@/lib/clinical/templates";
import { getSession } from "@/lib/auth/session";
import { db, withDbRetry } from "@/lib/db";
import type { VisitType } from "@prisma/client";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";
import { jerusalemDateKey, jerusalemDayBounds, shiftJerusalemDay } from "@/lib/visits/time";

export default async function HomePage() {
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const session = await getSession();
  const name = session.status === "ok" ? session.user.name : "";
  const { start, end } = jerusalemDayBounds();

  const now = new Date();
  const [snapshot, openTasks] = await Promise.all([
    withDbRetry(() => loadHome(start, end, now)),
    db.task.count({ where: { status: { not: "DONE" } } }),
  ]);
  const visitsToday = snapshot.visitsToday;
  const toValidate = snapshot.toValidate;
  const nextVisit = snapshot.nextVisit;

  const dateLabel = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const quickActions = [
    {
      href: "/transmissions",
      title: t(locale, "actionValidate"),
      subtitle: `${toValidate} ${t(locale, "statValidate").toLocaleLowerCase()}`,
      icon: <CheckIcon />,
      tone: toValidate > 0 ? ("danger" as const) : ("default" as const),
    },
    {
      href: "/today",
      title: t(locale, "actionToday"),
      subtitle: `${visitsToday} ${t(locale, "statVisits").toLocaleLowerCase()}`,
      icon: <CalendarIcon />,
    },
  ];

  return (
    <div className="-mx-1 flex flex-1 flex-col justify-between gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{capitalize(dateLabel)}</p>
          <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight">
            {name ? `${t(locale, "greeting")}, ${firstName(name)}` : t(locale, "greeting")}
          </h1>
        </div>
      </header>

      <Link
        href={
          nextVisit
            ? `/agenda?day=${jerusalemDateKey(nextVisit.occurredAt)}`
            : "/agenda"
        }
        className="flex items-center gap-4 rounded-3xl bg-card p-4 shadow-[0_8px_24px_rgba(27,36,48,0.06)]"
      >
        <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-accent-soft text-terra">
          <span className="text-sm font-semibold tabular-nums leading-none">
            {nextVisit
              ? new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
                  timeZone: "Asia/Jerusalem",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(nextVisit.occurredAt)
              : "—"}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-muted">{t(locale, "nextVisit")}</span>
          <span className="mt-0.5 block truncate text-[15px] font-semibold text-ink">
            {nextVisit
              ? `${nextVisit.patient.firstName} ${nextVisit.patient.lastName}`
              : t(locale, "nextVisitEmpty")}
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted">
            {nextVisit
              ? `${nextWhen(nextVisit.occurredAt, locale, now)} · ${t(locale, visitTypeLabel(nextVisit.type))}`
              : t(locale, "nextVisitOpen")}
          </span>
        </span>
        <ChevronIcon />
      </Link>

      <QuickActionGrid items={quickActions} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">{t(locale, "homeNeedTitle")}</h2>
        <SurfaceCard>
          <ActionRow
            href="/tasks"
            title={t(locale, "tasksTitle")}
            subtitle={openTasks > 0 ? `${openTasks} ${t(locale, "homeTasksHint").toLocaleLowerCase()}` : t(locale, "tasksEmpty")}
            icon={<CheckIcon />}
          />
          <div className="border-t border-line/70" />
          <ActionRow
            href="/visits"
            title={t(locale, "rowRecent")}
            subtitle={t(locale, "rowRecentHint")}
            icon={<ClockIcon />}
          />
          <div className="border-t border-line/70" />
          <ActionRow
            href="/transmissions"
            title={t(locale, "rowPending")}
            subtitle={
              toValidate > 0
                ? `${toValidate} ${t(locale, "reportPending").toLocaleLowerCase()}`
                : t(locale, "rowPendingHint")
            }
            icon={<DocIcon />}
            trailing={
              toValidate > 0 ? (
                <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
                  {toValidate}
                </span>
              ) : undefined
            }
          />
        </SurfaceCard>
      </section>

    </div>
  );
}

async function loadHome(start: Date, end: Date, now: Date) {
  const rows = await db.$queryRaw<
    {
      visits_today: number;
      to_validate: number;
      visit_id: string | null;
      occurred_at: Date | null;
      visit_type: VisitType | null;
      first_name: string | null;
      last_name: string | null;
    }[]
  >`
    SELECT
      (SELECT COUNT(*)::int FROM "Visit" WHERE "occurredAt" >= ${start} AND "occurredAt" < ${end}) AS visits_today,
      (SELECT COUNT(*)::int FROM "ClinicalReport" WHERE status IN ('AI_GENERATED', 'REVIEWED')) AS to_validate,
      v.id AS visit_id,
      v."occurredAt" AS occurred_at,
      v.type AS visit_type,
      p."firstName" AS first_name,
      p."lastName" AS last_name
    FROM (SELECT 1) AS stub
    LEFT JOIN LATERAL (
      SELECT id, "occurredAt", type, "patientId"
      FROM "Visit"
      WHERE "occurredAt" >= ${now}
      ORDER BY "occurredAt" ASC
      LIMIT 1
    ) v ON true
    LEFT JOIN "Patient" p ON p.id = v."patientId"
  `;
  const row = rows[0];
  return {
    visitsToday: Number(row?.visits_today ?? 0),
    toValidate: Number(row?.to_validate ?? 0),
    nextVisit:
      row?.visit_id && row.occurred_at && row.visit_type && row.first_name && row.last_name
        ? {
            id: row.visit_id,
            occurredAt: row.occurred_at,
            type: row.visit_type,
            patient: { firstName: row.first_name, lastName: row.last_name },
          }
        : null,
  };
}

function nextWhen(date: Date, locale: Parameters<typeof t>[0], now: Date) {
  const key = jerusalemDateKey(date);
  const today = jerusalemDateKey(now);
  if (key === today) return t(locale, "agendaToday");
  if (key === shiftJerusalemDay(today, 1)) return t(locale, "agendaTomorrow");
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function capitalize(value: string) {
  return value ? value.charAt(0).toLocaleUpperCase("fr-FR") + value.slice(1) : value;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M7.5 12.5 10.5 15.5 16.5 8.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <rect x="4.5" y="6" width="15" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 4.5V7M16 4.5V7M4.5 10h15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8.5V12l2.5 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-faint rtl:rotate-180" fill="none" aria-hidden="true">
      <path d="M9.5 7.5 14 12l-4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M8.5 5.5h5.8L17 8.2V18a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 18V7a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M13.5 5.5V8.5H17" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
