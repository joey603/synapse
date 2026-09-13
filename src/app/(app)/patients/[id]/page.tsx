import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { PatientDetailTabs } from "@/components/patient/PatientDetailTabs";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { db } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";
import { visitTypeLabel } from "@/lib/clinical/templates";
import { notFound } from "next/navigation";

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "timeline" } = await searchParams;
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);

  const patient = await db.patient.findUnique({
    where: { id },
    include: {
      visits: { orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 40, include: { report: true } },
      medications: { where: { active: true }, orderBy: { name: "asc" } },
    },
  });

  if (!patient) notFound();

  const fullName = `${patient.firstName} ${patient.lastName}`;
  const age = patient.birthDate ? ageInYears(patient.birthDate) : null;
  const meta = [patient.city, age !== null ? `${age} ${t(locale, "ageYears")}` : null]
    .filter(Boolean)
    .join(" • ");
  const statusLabel =
    patient.status === "ACTIVE" ? t(locale, "patientActive") : t(locale, "patientInactive");
  const identity = identityRows(locale, patient);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/patients"
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
        {t(locale, "backToPatients")}
      </Link>

      <SurfaceCard className="p-5">
        <div className="flex items-start gap-4">
          <Avatar name={fullName} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold leading-tight text-ink">{fullName}</h1>
            {meta ? <p className="mt-1 text-sm text-muted">{meta}</p> : null}
            <span className="mt-2 inline-flex rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
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

      <Link
        href={`/patients/${patient.id}/visits/new`}
        className="flex min-h-12 items-center justify-center rounded-2xl bg-accent text-base font-semibold text-white"
      >
        {t(locale, "newVisit")}
      </Link>

      <SurfaceCard className="p-5">
        <h2 className="text-sm font-semibold text-muted">{t(locale, "profileSummary")}</h2>
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-ink">
          {patient.currentSummary?.trim() || t(locale, "profileEmpty")}
        </p>
        {patient.primaryDiagnosis ? (
          <p className="mt-3 text-sm text-muted">{patient.primaryDiagnosis}</p>
        ) : null}
      </SurfaceCard>

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

      {tab === "timeline" ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted">{t(locale, "patientHistory")}</h2>
          {patient.visits.length === 0 ? (
            <EmptyState title={t(locale, "timelineEmpty")} body={t(locale, "timelineHint")} />
          ) : (
            <SurfaceCard>
              {patient.visits.map((visit, index) => {
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
                      href={`/patients/${patient.id}/visits/${visit.id}`}
                      className="flex min-h-[4.5rem] items-center justify-between gap-3 px-4 py-3 active:bg-surface/70"
                    >
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold text-ink">{date}</span>
                        <span className="block text-sm text-muted">{t(locale, visitTypeLabel(visit.type))}</span>
                      </span>
                      <ReportBadge
                        locale={locale}
                        status={visit.report?.status}
                        planned={visit.occurredAt.getTime() > Date.now() && visit.report?.status === "DRAFT"}
                      />
                    </Link>
                  </div>
                );
              })}
            </SurfaceCard>
          )}
        </section>
      ) : null}
    </div>
  );
}

function ReportBadge({
  locale,
  status,
  planned = false,
}: {
  locale: ReturnType<typeof resolveLocale>;
  status: "DRAFT" | "AI_GENERATED" | "REVIEWED" | "VALIDATED" | undefined;
  planned?: boolean;
}) {
  if (planned) {
    return (
      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
        {t(locale, "agendaPlanned")}
      </span>
    );
  }
  if (status === "AI_GENERATED" || status === "REVIEWED") {
    return (
      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
        {t(locale, "reportPending")}
      </span>
    );
  }
  if (status === "VALIDATED") {
    return (
      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
        {t(locale, "reportValidated")}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted">
      {t(locale, "visitDraft")}
    </span>
  );
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
