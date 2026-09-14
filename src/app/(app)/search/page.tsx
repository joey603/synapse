import Link from "next/link";
import { cookies } from "next/headers";

import { EmptyState } from "@/components/ui/EmptyState";
import { SearchField } from "@/components/ui/SearchField";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { db } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const query = (await searchParams).q?.trim() ?? "";
  const ready = query.length >= 2;

  const [patients, reports, tasks, meds, events] = ready
    ? await Promise.all([
        db.patient.findMany({
          where: {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { city: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 8,
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          select: { id: true, firstName: true, lastName: true, city: true },
        }),
        db.clinicalReport.findMany({
          where: {
            status: { in: ["VALIDATED", "REVIEWED"] },
            OR: [
              { finalText: { contains: query, mode: "insensitive" } },
              { editedDraft: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 8,
          orderBy: { updatedAt: "desc" },
          select: {
            status: true,
            finalText: true,
            editedDraft: true,
            visit: {
              select: {
                id: true,
                patientId: true,
                occurredAt: true,
                patient: { select: { firstName: true, lastName: true } },
              },
            },
          },
        }),
        db.task.findMany({
          where: { title: { contains: query, mode: "insensitive" } },
          take: 8,
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, patientId: true, patient: { select: { firstName: true, lastName: true } } },
        }),
        db.medication.findMany({
          where: { active: true, name: { contains: query, mode: "insensitive" } },
          take: 8,
          select: { id: true, name: true, patient: { select: { id: true, firstName: true, lastName: true } } },
        }),
        db.clinicalEvent.findMany({
          where: { title: { contains: query, mode: "insensitive" } },
          take: 8,
          select: { id: true, title: true, patientId: true, patient: { select: { firstName: true, lastName: true } } },
        }),
      ])
    : [[], [], [], [], []];

  const patientRows = [
    ...patients.map((patient) => ({
      id: patient.id,
      href: `/patients/${patient.id}`,
      title: `${patient.firstName} ${patient.lastName}`,
      meta: patient.city ?? "",
    })),
    ...meds.map((med) => ({
      id: `med-${med.id}`,
      href: `/patients/${med.patient.id}?tab=treatment`,
      title: `${med.patient.firstName} ${med.patient.lastName}`,
      meta: med.name,
    })),
    ...events.map((event) => ({
      id: `event-${event.id}`,
      href: `/patients/${event.patientId}?tab=timeline&filter=events`,
      title: `${event.patient.firstName} ${event.patient.lastName}`,
      meta: event.title,
    })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "searchTitle")}</h1>
      </header>
      <SearchField locale={locale} defaultValue={query} action="/search" />
      {!ready ? <p className="text-sm text-muted">{t(locale, "searchHint")}</p> : null}
      {ready && patientRows.length + reports.length + tasks.length === 0 ? (
        <EmptyState title={t(locale, "searchEmpty")} body={t(locale, "searchHint")} />
      ) : null}
      <Group title={t(locale, "searchGroupPatients")} rows={patientRows} />
      <Group
        title={t(locale, "searchGroupVisits")}
        rows={reports.map((report) => ({
          id: report.visit.id,
          href: `/patients/${report.visit.patientId}/visits/${report.visit.id}?tab=report`,
          title: `${report.visit.patient.firstName} ${report.visit.patient.lastName}`,
          meta: excerpt(report.status === "VALIDATED" ? report.finalText : report.editedDraft, query),
        }))}
      />
      <Group
        title={t(locale, "searchGroupTasks")}
        rows={tasks.map((task) => ({
          id: task.id,
          href: `/patients/${task.patientId}?tab=timeline&filter=tasks#task-${task.id}`,
          title: task.title,
          meta: `${task.patient.firstName} ${task.patient.lastName}`,
        }))}
      />
    </div>
  );
}

function Group({ title, rows }: { title: string; rows: Array<{ id: string; href: string; title: string; meta: string }> }) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      <SurfaceCard>
        {rows.map((row, index) => (
          <div key={row.id}>
            {index > 0 ? <div className="border-t border-line/70" /> : null}
            <Link href={row.href} className="block min-h-[4.5rem] px-4 py-3">
              <span className="block truncate text-[15px] font-semibold text-ink">{row.title}</span>
              {row.meta ? <span className="mt-0.5 block text-sm leading-5 text-muted">{row.meta}</span> : null}
            </Link>
          </div>
        ))}
      </SurfaceCard>
    </section>
  );
}

function excerpt(text: string | null, query: string) {
  if (!text) return "";
  const flat = text.replace(/\s+/g, " ").trim();
  const at = flat.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (at < 0) return flat.slice(0, 140);
  const start = Math.max(0, at - 40);
  return `${start > 0 ? "…" : ""}${flat.slice(start, start + 140)}`;
}
