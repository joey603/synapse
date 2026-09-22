import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { TaskInbox } from "@/components/tasks/TaskInbox";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { VisitForm } from "@/components/visits/VisitForm";
import { weeklyHadShortLabel } from "@/components/visits/WeeklyHadProgress";
import { EmptyState } from "@/components/ui/EmptyState";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { visitTypeLabel } from "@/lib/clinical/templates";
import { db, join, withDbRetry } from "@/lib/db";
import { resolveLocale, type Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";
import { weekStartsOnFor } from "@/lib/visits/had-week";
import { loadWeeklyHadForPatients } from "@/lib/visits/had-week-load";
import {
  formatJerusalemInput,
  isJerusalemDayKey,
  jerusalemDateKey,
  jerusalemDayBoundsFor,
} from "@/lib/visits/time";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string; edit?: string; error?: string; tab?: string }>;
}) {
  const { month, day, edit, error, tab = "visits" } = await searchParams;
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const now = new Date();
  const todayKey = jerusalemDateKey(now);
  const requestedDay = isJerusalemDayKey(day ?? "") ? day! : null;

  const monthKnown = monthKeyOf(month) ?? (requestedDay ? requestedDay.slice(0, 7) : null);
  const needsEditFirst = Boolean(edit && !monthKnown);
  const editingFirst = needsEditFirst
    ? await withDbRetry(() =>
        db.visit.findUnique({
          where: { id: edit },
          ...join,
          include: { patient: { select: { id: true, firstName: true, lastName: true } } },
        }),
      )
    : null;

  const monthKey =
    monthKnown ??
    (editingFirst ? jerusalemDateKey(editingFirst.occurredAt).slice(0, 7) : null) ??
    todayKey.slice(0, 7);
  const selectedDay =
    requestedDay && requestedDay.startsWith(monthKey)
      ? requestedDay
      : editingFirst && jerusalemDateKey(editingFirst.occurredAt).startsWith(monthKey)
        ? jerusalemDateKey(editingFirst.occurredAt)
        : null;
  const showSchedule = Boolean(selectedDay && (requestedDay || edit || error));

  const days = monthDays(monthKey);
  const rangeStart = jerusalemDayBoundsFor(days[0]!)?.start ?? now;
  const rangeEnd = jerusalemDayBoundsFor(days[days.length - 1]!)?.end ?? now;
  const weekStart = weekStartsOnFor(locale);
  const leading = weekdayColumn(days[0]!, weekStart);

  const [editing, patients, visits] = await withDbRetry(() =>
    Promise.all([
      edit && !editingFirst
        ? db.visit.findUnique({
            where: { id: edit },
            ...join,
            include: { patient: { select: { id: true, firstName: true, lastName: true } } },
          })
        : editingFirst,
      showSchedule && !edit
        ? db.patient.findMany({
            where: { status: "ACTIVE" },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
            select: {
              id: true,
              firstName: true,
              lastName: true,
              city: true,
              weeklyInPersonVisits: true,
              weeklyVirtualVisits: true,
            },
          })
        : [],
      db.visit.findMany({
        ...join,
        where: { occurredAt: { gte: rangeStart, lt: rangeEnd } },
        orderBy: { occurredAt: "asc" },
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              city: true,
              weeklyInPersonVisits: true,
              weeklyVirtualVisits: true,
            },
          },
        },
      }),
    ]),
  );

  const counts = new Map<string, number>();
  for (const visit of visits) {
    const key = jerusalemDateKey(visit.occurredAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const activeDay =
    selectedDay ??
    (editing && jerusalemDateKey(editing.occurredAt).startsWith(monthKey)
      ? jerusalemDateKey(editing.occurredAt)
      : null);
  const openSchedule = Boolean(activeDay && (requestedDay || editing || error));
  const dayVisits = activeDay
    ? visits.filter((visit) => jerusalemDateKey(visit.occurredAt) === activeDay)
    : [];
  const weekByPatient = await loadWeeklyHadForPatients(
    db,
    [
      ...new Map(
        [
          ...patients.map((patient) => [
            patient.id,
            {
              id: patient.id,
              weeklyInPersonVisits: patient.weeklyInPersonVisits,
              weeklyVirtualVisits: patient.weeklyVirtualVisits,
            },
          ] as const),
          ...dayVisits.map((visit) => [
            visit.patientId,
            {
              id: visit.patientId,
              weeklyInPersonVisits: visit.patient.weeklyInPersonVisits,
              weeklyVirtualVisits: visit.patient.weeklyVirtualVisits,
            },
          ] as const),
        ],
      ).values(),
    ],
    now,
    weekStart,
  );
  const headers = weekHeaders(locale, weekStart);
  const prev = shiftMonth(monthKey, -1);
  const next = shiftMonth(monthKey, 1);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "agendaTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t(locale, "agendaHint")}</p>
      </header>
      <Suspense fallback={null}>
        <SegmentedControl
          scroll={false}
          activeId={tab === "tasks" ? "tasks" : "visits"}
          segments={[
            { id: "visits", label: t(locale, "filterVisits"), href: `/agenda?month=${monthKey}` },
            { id: "tasks", label: t(locale, "filterTasks"), href: `/agenda?tab=tasks` },
          ]}
        />
      </Suspense>
      {tab === "tasks" ? <TaskInbox locale={locale} next="/agenda?tab=tasks" /> : null}

      {tab === "tasks" ? null : <SurfaceCard className="p-3">
        <div className="flex items-center justify-between gap-2 px-1 pb-3">
          <Link
            href={`/agenda?month=${prev}`}
            aria-label={t(locale, "agendaPrev")}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-xl font-semibold text-ink"
          >
            <span aria-hidden="true">{locale === "he" ? ">" : "<"}</span>
          </Link>
          <p className="text-[15px] font-semibold capitalize text-ink">{monthTitle(monthKey, locale)}</p>
          <Link
            href={`/agenda?month=${next}`}
            aria-label={t(locale, "agendaNext")}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-xl font-semibold text-ink"
          >
            <span aria-hidden="true">{locale === "he" ? "<" : ">"}</span>
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {headers.map((label) => (
            <span key={label} className="py-1 text-[11px] font-medium text-muted">
              {label}
            </span>
          ))}
          {Array.from({ length: leading }, (_, index) => (
            <span key={`pad-${index}`} />
          ))}
          {days.map((key) => {
            const selected = key === activeDay && openSchedule;
            const count = counts.get(key) ?? 0;
            return (
              <Link
                key={key}
                href={`/agenda?month=${monthKey}&day=${key}#schedule`}
                className={`flex min-h-11 flex-col items-center justify-center rounded-2xl text-sm font-semibold ${
                  selected
                    ? "bg-accent text-white"
                    : key === todayKey
                      ? "bg-accent-soft text-accent"
                      : "text-ink"
                }`}
              >
                {Number(key.slice(8))}
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                    count === 0 ? "bg-transparent" : selected ? "bg-white" : "bg-accent"
                  }`}
                />
              </Link>
            );
          })}
        </div>
      </SurfaceCard>}

      {tab === "tasks" ? null : openSchedule && activeDay ? (
        <section id="schedule" className="flex scroll-mt-4 flex-col gap-4">
          <div>
            <h2 className="text-sm font-semibold text-muted">{dayHeading(activeDay, locale, todayKey)}</h2>
            {dayVisits.length === 0 ? (
              <p className="mt-1 text-sm text-muted">{t(locale, "agendaEmpty")}</p>
            ) : (
              <SurfaceCard className="mt-3">
                {dayVisits.map((visit, index) => (
                  <div key={visit.id}>
                    {index > 0 ? <div className="border-t border-line/70" /> : null}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Link
                        href={`/patients/${visit.patientId}/visits/${visit.id}`}
                        className="flex min-h-14 min-w-0 flex-1 items-center gap-3"
                      >
                        <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-accent">
                          {formatJerusalemInput(visit.occurredAt).slice(11)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[15px] font-semibold text-ink">
                            {visit.patient.firstName} {visit.patient.lastName}
                          </span>
                          <span className="block truncate text-sm text-muted">
                            {[
                              t(locale, visitTypeLabel(visit.type)),
                              visit.patient.city,
                              weeklyHadShortLabel(locale, weekByPatient.get(visit.patientId)),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </Link>
                      <Link
                        href={`/agenda?month=${monthKey}&day=${activeDay}&edit=${visit.id}#schedule`}
                        className="shrink-0 text-sm font-semibold text-accent"
                      >
                        {t(locale, "agendaEdit")}
                      </Link>
                    </div>
                  </div>
                ))}
              </SurfaceCard>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink">
              {editing ? t(locale, "agendaEdit") : t(locale, "agendaSchedule")}
            </h2>
            {editing ? (
              <p className="mt-1 text-sm text-muted">
                {editing.patient.firstName} {editing.patient.lastName}
              </p>
            ) : null}
            <div className="mt-3">
              {patients.length === 0 && !editing ? (
                <EmptyState title={t(locale, "patientsEmpty")} body={t(locale, "patientsHint")} />
              ) : (
                <VisitForm
                  locale={locale}
                  action={editing ? `/api/visits/${editing.id}` : "/api/visits"}
                  patientId={editing?.patientId}
                  patients={
                    editing
                      ? undefined
                      : patients.map((patient) => ({
                          id: patient.id,
                          firstName: patient.firstName,
                          lastName: patient.lastName,
                          city: patient.city,
                          weekLabel: weeklyHadShortLabel(locale, weekByPatient.get(patient.id)),
                        }))
                  }
                  returnTo={`/agenda?month=${monthKey}&day=${activeDay}`}
                  type={editing?.type}
                  occurredAt={
                    editing ? formatJerusalemInput(editing.occurredAt) : `${activeDay}T09:00`
                  }
                  notes={editing?.notes}
                  error={error === "save" ? "save" : error === "invalid" ? "invalid" : null}
                  submitLabel={t(locale, editing ? "agendaUpdate" : "agendaSchedule")}
                />
              )}
            </div>
          </div>
        </section>
      ) : (
        <p className="text-center text-sm text-muted">{t(locale, "agendaPick")}</p>
      )}
    </div>
  );
}

function monthKeyOf(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return value;
}

function shiftMonth(key: string, delta: number) {
  const [year, month] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthDays(key: string) {
  const [year, month] = key.split("-").map(Number);
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => `${key}-${String(index + 1).padStart(2, "0")}`);
}

function weekdayColumn(key: string, weekStart: number) {
  const start = jerusalemDayBoundsFor(key)?.start;
  if (!start) return 0;
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
  }).format(start);
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
  if (index < 0) return 0;
  return (index - weekStart + 7) % 7;
}

function weekHeaders(locale: Locale, weekStart: number) {
  const sunday = new Date(Date.UTC(2024, 0, 7, 12));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday.getTime() + ((index + weekStart) % 7) * 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
      weekday: "short",
      timeZone: "UTC",
    }).format(date);
  });
}

function monthTitle(key: string, locale: Locale) {
  const start = jerusalemDayBoundsFor(`${key}-01`)?.start;
  if (!start) return key;
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
    timeZone: "Asia/Jerusalem",
    month: "long",
    year: "numeric",
  }).format(start);
}

function dayHeading(key: string, locale: Locale, todayKey: string) {
  const start = jerusalemDayBoundsFor(key)?.start;
  if (!start) return key;
  if (key === todayKey) {
    const date = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
      timeZone: "Asia/Jerusalem",
      day: "numeric",
      month: "long",
    }).format(start);
    return `${t(locale, "agendaToday")} · ${date}`;
  }
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(start);
}
