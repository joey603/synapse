import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { PatientListRow } from "@/components/ui/PatientListRow";
import { SearchField } from "@/components/ui/SearchField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { db, withDbRetry } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";
import { patientPhotoUrl } from "@/lib/patients/photo";
import type { PatientStatus } from "@prisma/client";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const { q = "", tab = "active" } = await searchParams;
  const query = q.trim();

  const statusFilter: PatientStatus | undefined =
    tab === "all" ? undefined : tab === "pending" ? "ACTIVE" : "ACTIVE";

  const patients = await withDbRetry(() =>
    db.patient.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(query
          ? {
              OR: [
                { firstName: { contains: query, mode: "insensitive" } },
                { lastName: { contains: query, mode: "insensitive" } },
                { city: { contains: query, mode: "insensitive" } },
                { phone: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex shrink-0 items-baseline justify-between gap-3">
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "patientsTitle")}</h1>
        <p className="shrink-0 text-sm font-medium tabular-nums text-muted">
          {patients.length} {t(locale, patients.length === 1 ? "patientCountOne" : "patientCountMany")}
        </p>
      </header>

      <Link
        href="/patients/new"
        className="flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-base font-semibold text-white"
      >
        {t(locale, "newPatient")}
      </Link>

      <div className="shrink-0">
        <SearchField locale={locale} defaultValue={query} params={tab === "all" ? { tab: "all" } : undefined} />
      </div>

      <div className="shrink-0">
        <Suspense fallback={null}>
          <SegmentedControl
            segments={[
              { id: "active", label: t(locale, "tabActive"), href: "/patients?tab=active" },
              { id: "all", label: t(locale, "tabAll"), href: "/patients?tab=all" },
            ]}
          />
        </Suspense>
      </div>

      {patients.length === 0 ? (
        <EmptyState title={t(locale, "patientsEmpty")} body={t(locale, "patientsHint")} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-synapse-md bg-card ring-1 ring-line/70">
          <div className="patient-scroll min-h-0 flex-1 overflow-y-auto">
            {patients.map((patient, index) => {
              const name = `${patient.firstName} ${patient.lastName}`;
              const meta = [patient.city, patient.primaryDiagnosis].filter(Boolean).join(" • ");
              const badge =
                patient.status === "DISCHARGED"
                  ? t(locale, "patientDischarged")
                  : patient.status === "INACTIVE"
                    ? t(locale, "patientInactive")
                    : t(locale, "patientActive");

              return (
                <div key={patient.id}>
                  {index > 0 ? <div className="border-t border-line/70" /> : null}
                  <PatientListRow
                    href={`/patients/${patient.id}`}
                    name={name}
                    meta={meta || badge}
                    badge={meta ? badge : undefined}
                    badgeTone={patient.status === "ACTIVE" ? "success" : patient.status === "DISCHARGED" ? "muted" : "danger"}
                    photoUrl={patientPhotoUrl(patient.id, patient.photoKey, patient.updatedAt)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
