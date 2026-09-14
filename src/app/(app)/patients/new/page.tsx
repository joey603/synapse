import Link from "next/link";
import { cookies } from "next/headers";

import { PatientForm } from "@/components/patient/PatientForm";
import { BackChevron } from "@/components/ui/BackChevron";
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

  return (
    <div className="flex flex-col gap-5">
      <Link href="/patients" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted">
        <BackChevron locale={locale} />
        {t(locale, "backToPatients")}
      </Link>
      <header>
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "newPatient")}</h1>
        <p className="mt-1 text-sm text-muted">{t(locale, "newPatientHint")}</p>
      </header>
      <PatientForm
        locale={locale}
        action="/api/patients"
        cancelHref="/patients"
        error={error === "save" ? "save" : error === "invalid" ? "invalid" : null}
      />
    </div>
  );
}
