import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { PatientListRow } from "@/components/ui/PatientListRow";
import { SearchField } from "@/components/ui/SearchField";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { db } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";
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

  const patients = await db.patient.findMany({
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
  });

  return (
    <div className="absolute inset-x-5 top-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] flex min-h-0 flex-col gap-4 overflow-hidden">
      <header>
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "patientsTitle")}</h1>
        <p className="mt-1 text-sm font-medium tabular-nums text-muted">
          {patients.length} {t(locale, patients.length === 1 ? "patientCountOne" : "patientCountMany")}
        </p>
      </header>

      <Link
        href="/patients/new"
        className="flex min-h-12 items-center justify-center rounded-2xl bg-accent text-base font-semibold text-white"
      >
        {t(locale, "newPatient")}
      </Link>

      <SearchField locale={locale} defaultValue={query} params={tab === "all" ? { tab: "all" } : undefined} />

      <Suspense fallback={null}>
        <SegmentedControl
          segments={[
            { id: "active", label: t(locale, "tabActive"), href: "/patients?tab=active" },
            { id: "all", label: t(locale, "tabAll"), href: "/patients?tab=all" },
          ]}
        />
      </Suspense>

      <div className="min-h-0 flex-1 overflow-hidden rounded-3xl">
        {patients.length === 0 ? (
          <EmptyState title={t(locale, "patientsEmpty")} body={t(locale, "patientsHint")} />
        ) : (
          <div className="patient-scroll h-full overflow-y-auto overscroll-contain">
            <SurfaceCard className="min-h-full">
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
                  />
                </div>
              );
            })}
            </SurfaceCard>
          </div>
        )}
      </div>
    </div>
  );
}
