import Link from "next/link";
import { cookies } from "next/headers";

import { ActionRow } from "@/components/ui/ActionRow";
import { QuickActionGrid } from "@/components/ui/QuickActionGrid";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { visitTypeLabel } from "@/lib/clinical/templates";
import { getSession } from "@/lib/auth/session";
import { db, withDbRetry } from "@/lib/db";
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
  const [visitsToday, toValidate, nextVisit] = await withDbRetry(() => Promise.all([
    db.visit.count({ where: { occurredAt: { gte: start, lt: end } } }),
    db.clinicalReport.count({
      where: { status: { in: ["AI_GENERATED", "REVIEWED"] } },
    }),
    db.visit.findFirst({
      where: { occurredAt: { gte: now } },
      orderBy: { occurredAt: "asc" },
      include: { patient: true },
    }),
  ]));

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
    <div className="flex flex-col gap-6">
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
        <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-accent-soft text-accent">
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
