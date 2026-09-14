import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { PatientCockpit } from "@/components/patient/PatientCockpit";
import { PatientDetailTabs } from "@/components/patient/PatientDetailTabs";
import { PatientTimeline } from "@/components/patient/PatientTimeline";
import { Avatar } from "@/components/ui/Avatar";
import { BackChevron } from "@/components/ui/BackChevron";
import { EmptyState } from "@/components/ui/EmptyState";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { jerusalemDay } from "@/lib/clinical/cockpit";
import { visitTypeLabel } from "@/lib/clinical/templates";
import { db, join } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";
import { workflowStatus } from "@/lib/visits/workflow-status";
import { notFound } from "next/navigation";

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; filter?: string; page?: string }>;
}) {
  const { id } = await params;
  const { tab = "timeline", filter = "all", page = "1" } = await searchParams;
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);

  const patient = await db.patient.findUnique({
    ...join,
    where: { id },
    include: {
      visits: {
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: 100,
        include: { report: true, recording: true, transcript: { select: { id: true } }, extraction: { select: { id: true } } },
      },
      medications: { where: { active: true }, orderBy: { name: "asc" } },
      events: { orderBy: { occurredAt: "desc" }, take: 100 },
      tasks: { orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], take: 100 },
    },
  });

  if (!patient) notFound();

  const fullName = `${patient.firstName} ${patient.lastName}`;
  const age = patient.birthDate ? ageInYears(patient.birthDate) : null;
  const meta = [patient.city, age !== null ? `${age} ${t(locale, "ageYears")}` : null]
    .filter(Boolean)
    .join(" • ");
  const statusLabel = statusText(locale, patient.status);
  const now = new Date();
  const timed = patient.visits.map((visit) => ({
    ...visit,
    workflow: workflowStatus({
      recordingStored: visit.recording?.status === "STORED",
      hasTranscript: Boolean(visit.transcript),
      hasExtraction: Boolean(visit.extraction),
      reportStatus: visit.report?.status,
      pipelineStatus: visit.pipelineStatus,
    }),
  }));
  const nextVisit = [...timed].reverse().find((visit) => visit.occurredAt.getTime() > now.getTime()) ?? null;
  const unfinished = timed.find((visit) => visit.occurredAt.getTime() <= now.getTime() && visit.workflow !== "VALIDATED") ?? null;
  const identity = identityRows(locale, patient);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/patients"
        className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted"
      >
        <BackChevron locale={locale} />
        {t(locale, "backToPatients")}
      </Link>

      <SurfaceCard className="p-5">
        <div className="flex items-start gap-4">
          <Avatar name={fullName} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold leading-tight text-ink">{fullName}</h1>
            {meta ? <p className="mt-1 text-sm text-muted">{meta}</p> : null}
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(patient.status)}`}>
              {statusLabel}
            </span>
          </div>
          <Link
            href={`/patients/${patient.id}/edit`}
            className="shrink-0 rounded-full bg-surface px-3 py-2 text-sm font-semibold text-accent"
          >
            {t(locale, "editFile")}
          </Link>
        </div>
      </SurfaceCard>

      <PatientCockpit
        locale={locale}
        patientId={patient.id}
        today={jerusalemDay(now)}
        nextVisit={nextVisit ? { id: nextVisit.id, occurredAt: nextVisit.occurredAt, typeLabel: t(locale, visitTypeLabel(nextVisit.type)), workflow: nextVisit.workflow } : null}
        unfinished={unfinished ? { id: unfinished.id, occurredAt: unfinished.occurredAt, typeLabel: t(locale, visitTypeLabel(unfinished.type)), workflow: unfinished.workflow } : null}
        tasks={patient.tasks}
        summary={patient.currentSummary}
        diagnosis={patient.primaryDiagnosis}
      />

      <Suspense fallback={null}>
        <PatientDetailTabs locale={locale} patientId={patient.id} />
      </Suspense>

      {tab === "profile" ? (
        <SurfaceCard>
          {identity.map((row, index) => (
            <div key={row.label}>
              {index > 0 ? <div className="border-t border-line/70" /> : null}
              <div className="px-4 py-3">
                <p className="text-xs font-medium text-muted">{row.label}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-[15px] text-ink">{row.value}</p>
              </div>
            </div>
          ))}
        </SurfaceCard>
      ) : null}

      {tab === "treatment" ? (
        patient.medications.length === 0 ? (
          <EmptyState title={t(locale, "treatmentEmpty")} body={t(locale, "treatmentHint")} />
        ) : (
          <SurfaceCard>
            {patient.medications.map((med, index) => (
              <div key={med.id}>
                {index > 0 ? <div className="border-t border-line/70" /> : null}
                <div className="px-4 py-4">
                  <p className="text-[15px] font-semibold text-ink">{med.name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {[med.dose, med.frequency, med.route].filter(Boolean).join(" • ")}
                  </p>
                </div>
              </div>
            ))}
          </SurfaceCard>
        )
      ) : null}

      {tab === "tasks" || filter === "tasks" ? (
        <PatientTasks locale={locale} patientId={patient.id} tasks={patient.tasks} />
      ) : null}

      {tab === "timeline" && filter !== "tasks" ? (
        <PatientTimeline
          locale={locale}
          patientId={patient.id}
          visits={timed}
          events={patient.events}
          filter={["visits", "treatment", "events"].includes(filter) ? filter : "all"}
          page={Math.min(Math.max(Number(page) || 1, 1), 5)}
        />
      ) : null}
    </div>
  );
}

function PatientTasks({
  locale,
  patientId,
  tasks,
}: {
  locale: ReturnType<typeof resolveLocale>;
  patientId: string;
  tasks: Array<{
    id: string;
    title: string;
    status: "TODO" | "WAITING" | "DONE";
    priority: "NORMAL" | "IMPORTANT" | "URGENT";
    dueDate: Date | null;
  }>;
}) {
  const ordered = [...tasks.filter((task) => task.status !== "DONE"), ...tasks.filter((task) => task.status === "DONE")];

  return (
    <section className="flex flex-col gap-3">
      {ordered.length === 0 ? <EmptyState title={t(locale, "tasksEmpty")} body={t(locale, "homeTasksHint")} /> : null}
      {ordered.length > 0 ? (
        <SurfaceCard>
          {ordered.map((task, index) => {
            const done = task.status === "DONE";
            return (
              <div key={task.id} id={`task-${task.id}`}>
                {index > 0 ? <div className="border-t border-line/70" /> : null}
                <div className={`flex items-center gap-3 px-4 py-3 ${done ? "opacity-60" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[15px] font-semibold ${done ? "text-faint line-through" : "text-ink"}`}>{task.title}</p>
                    <p className={`truncate text-sm ${done ? "text-faint line-through" : "text-muted"}`}>
                      {task.dueDate
                        ? new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
                            timeZone: "Asia/Jerusalem",
                            day: "numeric",
                            month: "short",
                          }).format(task.dueDate)
                        : t(locale, "taskOpen")}
                      {task.priority !== "NORMAL" ? ` · ${t(locale, task.priority === "URGENT" ? "priorityUrgent" : "priorityImportant")}` : ""}
                      {task.status === "WAITING" ? ` · ${t(locale, "taskWaiting")}` : ""}
                    </p>
                  </div>
                  <form action={`/api/tasks/${task.id}/done`} method="post">
                    <input type="hidden" name="next" value={`/patients/${patientId}?tab=tasks`} />
                    <button
                      className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${done ? "bg-surface text-muted" : "bg-terra text-white"}`}
                    >
                      {t(locale, done ? "taskReopen" : "taskDone")}
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </SurfaceCard>
      ) : null}
      <details className="rounded-2xl bg-terra-soft">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center px-3 text-sm font-semibold text-terra [&::-webkit-details-marker]:hidden">
          {t(locale, "addTask")}
        </summary>
        <form action={`/api/patients/${patientId}/tasks`} method="post" className="flex flex-col gap-2 px-3 pb-3">
          <input type="hidden" name="next" value={`/patients/${patientId}?tab=tasks`} />
          <input name="title" required maxLength={160} placeholder={t(locale, "eventTitle")} className="min-h-11 rounded-xl bg-field px-3 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select name="priority" className="min-h-11 rounded-xl bg-field px-2 text-sm">
              <option value="NORMAL">{t(locale, "priorityNormal")}</option>
              <option value="IMPORTANT">{t(locale, "priorityImportant")}</option>
              <option value="URGENT">{t(locale, "priorityUrgent")}</option>
            </select>
            <input name="dueDate" type="date" className="min-h-11 rounded-xl bg-field px-2 text-sm" />
          </div>
          <button className="min-h-11 rounded-xl bg-terra text-sm font-semibold text-white">{t(locale, "addTask")}</button>
        </form>
      </details>
    </section>
  );
}

function statusText(locale: ReturnType<typeof resolveLocale>, status: "ACTIVE" | "INACTIVE" | "DISCHARGED") {
  if (status === "DISCHARGED") return t(locale, "patientDischarged");
  if (status === "INACTIVE") return t(locale, "patientInactive");
  return t(locale, "patientActive");
}

function statusTone(status: "ACTIVE" | "INACTIVE" | "DISCHARGED") {
  if (status === "ACTIVE") return "bg-success-soft text-success";
  if (status === "DISCHARGED") return "bg-surface text-muted";
  return "bg-danger-soft text-danger";
}

function ageInYears(birthDate: Date, now = new Date()) {
  const birth = birthDate.toISOString().slice(0, 10).split("-").map(Number);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  let age = today[0] - birth[0];
  if (today[1] < birth[1] || (today[1] === birth[1] && today[2] < birth[2])) age -= 1;
  return age;
}

function identityRows(
  locale: ReturnType<typeof resolveLocale>,
  patient: {
    phone: string | null;
    address: string | null;
    contactName: string | null;
    contactPhone: string | null;
    insurer: string | null;
    referringPsychiatrist: string | null;
    referringNurse: string | null;
    admittedAt: Date | null;
    primaryDiagnosis: string | null;
    secondaryDiagnoses: string | null;
    psychHistory: string | null;
    somaticHistory: string | null;
    suicideHistory: string | null;
    addictions: string | null;
    allergies: string | null;
    riskFactors: string | null;
    protectiveFactors: string | null;
  },
) {
  const date = patient.admittedAt
    ? new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
        timeZone: "UTC",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(patient.admittedAt)
    : null;

  const rows: Array<[string, string | null]> = [
    [t(locale, "fieldPhone"), patient.phone],
    [t(locale, "fieldAddress"), patient.address],
    [t(locale, "fieldContactName"), patient.contactName],
    [t(locale, "fieldContactPhone"), patient.contactPhone],
    [t(locale, "fieldInsurer"), patient.insurer],
    [t(locale, "fieldPsychiatrist"), patient.referringPsychiatrist],
    [t(locale, "fieldNurse"), patient.referringNurse],
    [t(locale, "fieldAdmittedAt"), date],
    [t(locale, "fieldDiagnosis"), patient.primaryDiagnosis],
    [t(locale, "fieldSecondary"), patient.secondaryDiagnoses],
    [t(locale, "fieldPsychHistory"), patient.psychHistory],
    [t(locale, "fieldSomatic"), patient.somaticHistory],
    [t(locale, "fieldSuicideHistory"), patient.suicideHistory],
    [t(locale, "fieldAddictions"), patient.addictions],
    [t(locale, "fieldAllergies"), patient.allergies],
    [t(locale, "fieldRisks"), patient.riskFactors],
    [t(locale, "fieldProtective"), patient.protectiveFactors],
  ];

  return rows.flatMap(([label, value]) => (value?.trim() ? [{ label, value }] : []));
}
