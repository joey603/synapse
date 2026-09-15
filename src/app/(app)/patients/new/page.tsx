import { cookies } from "next/headers";

import { PatientForm } from "@/components/patient/PatientForm";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export default async function NewPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const { error } = await searchParams;

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
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "newPatient")}</h1>
        <p className="mt-1 text-sm text-muted">{t(locale, "newPatientHint")}</p>
      </header>
      <PatientForm
        locale={locale}
        action="/api/patients"
        cancelHref="/patients"
        error={formError}
      />
    </div>
  );
}
