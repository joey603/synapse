import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { PatientForm } from "@/components/patient/PatientForm";
import { db } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";
import { patientPhotoUrl } from "@/lib/patients/photo";

export default async function EditPatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) notFound();

  const formError =
    error === "save"
      ? "save"
      : error === "invalid"
        ? "invalid"
        : error === "type"
          ? "type"
          : error === "size"
            ? "size"
            : null;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "editPatient")}</h1>
        <p className="mt-1 text-sm text-muted">
          {patient.firstName} {patient.lastName}
        </p>
      </header>
      <PatientForm
        locale={locale}
        action={`/api/patients/${id}`}
        cancelHref={`/patients/${id}`}
        values={patient}
        photoUrl={patientPhotoUrl(patient.id, patient.photoKey, patient.updatedAt)}
        error={formError}
      />
    </div>
  );
}
