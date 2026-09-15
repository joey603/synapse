import Link from "next/link";

import { PatientPhotoField } from "@/components/patient/PatientPhotoField";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Locale } from "@/lib/i18n/locale";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { toInputDate, type PatientInput } from "@/lib/patients/parse";

type Values = Partial<PatientInput> & {
  firstName?: string;
  lastName?: string;
};

export function PatientForm({
  locale,
  action,
  values,
  error,
  cancelHref,
  photoUrl,
}: {
  locale: Locale;
  action: string;
  values?: Values;
  error?: "invalid" | "save" | "type" | "size" | null;
  cancelHref: string;
  photoUrl?: string | null;
}) {
  const previewName = [values?.firstName, values?.lastName].filter(Boolean).join(" ");

  return (
    <form
      action={action}
      method="post"
      encType="multipart/form-data"
      className="flex flex-col gap-4 pb-8"
    >
      {error ? (
        <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm leading-6 text-danger" role="alert">
          {t(
            locale,
            error === "save"
              ? "formSaveError"
              : error === "type"
                ? "photoTypeError"
                : error === "size"
                  ? "photoSizeError"
                  : "formInvalid",
          )}
        </p>
      ) : null}

      <SurfaceCard className="flex flex-col gap-4 p-4">
        <h2 className="text-sm font-semibold text-muted">{t(locale, "identityTitle")}</h2>
        <PatientPhotoField locale={locale} name={previewName} photoUrl={photoUrl} />
        <Field locale={locale} name="firstName" label="fieldFirstName" required defaultValue={values?.firstName} />
        <Field locale={locale} name="lastName" label="fieldLastName" required defaultValue={values?.lastName} />
        <Field locale={locale} name="birthDate" label="fieldBirthDate" type="date" defaultValue={toInputDate(values?.birthDate)} />
        <Select
          locale={locale}
          name="sex"
          label="fieldSex"
          value={values?.sex ?? "UNSPECIFIED"}
          options={[
            ["UNSPECIFIED", "sexUnspecified"],
            ["FEMALE", "sexFemale"],
            ["MALE", "sexMale"],
            ["OTHER", "sexOther"],
          ]}
        />
        <Field locale={locale} name="phone" label="fieldPhone" type="tel" defaultValue={values?.phone} />
        <Field locale={locale} name="city" label="fieldCity" defaultValue={values?.city} />
        <Field locale={locale} name="address" label="fieldAddress" defaultValue={values?.address} />
        <Field locale={locale} name="contactName" label="fieldContactName" defaultValue={values?.contactName} />
        <Field locale={locale} name="contactPhone" label="fieldContactPhone" type="tel" defaultValue={values?.contactPhone} />
        <Field locale={locale} name="insurer" label="fieldInsurer" defaultValue={values?.insurer} />
        <Field locale={locale} name="referringPsychiatrist" label="fieldPsychiatrist" defaultValue={values?.referringPsychiatrist} />
        <Field locale={locale} name="referringNurse" label="fieldNurse" defaultValue={values?.referringNurse} />
        <Field locale={locale} name="admittedAt" label="fieldAdmittedAt" type="date" defaultValue={toInputDate(values?.admittedAt)} />
        <Select
          locale={locale}
          name="status"
          label="fieldStatus"
          value={values?.status ?? "ACTIVE"}
          options={[
            ["ACTIVE", "patientActive"],
            ["INACTIVE", "patientInactive"],
            ["DISCHARGED", "patientDischarged"],
          ]}
        />
      </SurfaceCard>

      <SurfaceCard className="flex flex-col gap-4 p-4">
        <h2 className="text-sm font-semibold text-muted">{t(locale, "clinicalTitle")}</h2>
        <Field locale={locale} name="primaryDiagnosis" label="fieldDiagnosis" defaultValue={values?.primaryDiagnosis} />
        <Area locale={locale} name="secondaryDiagnoses" label="fieldSecondary" defaultValue={values?.secondaryDiagnoses} />
        <Area locale={locale} name="psychHistory" label="fieldPsychHistory" defaultValue={values?.psychHistory} />
        <Area locale={locale} name="somaticHistory" label="fieldSomatic" defaultValue={values?.somaticHistory} />
        <Area locale={locale} name="suicideHistory" label="fieldSuicideHistory" defaultValue={values?.suicideHistory} />
        <Area locale={locale} name="addictions" label="fieldAddictions" defaultValue={values?.addictions} />
        <Area locale={locale} name="allergies" label="fieldAllergies" defaultValue={values?.allergies} />
        <Area locale={locale} name="riskFactors" label="fieldRisks" defaultValue={values?.riskFactors} />
        <Area locale={locale} name="protectiveFactors" label="fieldProtective" defaultValue={values?.protectiveFactors} />
        <Area locale={locale} name="currentSummary" label="fieldSummary" defaultValue={values?.currentSummary} rows={6} />
      </SurfaceCard>

      <div className="fixed inset-x-0 bottom-0 z-20 bg-surface">
        <div className="mx-auto flex max-w-lg gap-3 border-t border-line/70 px-5 pt-2 pb-[calc(4.65rem+env(safe-area-inset-bottom))]">
          <Link
            href={cancelHref}
            className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-card text-sm font-semibold text-muted shadow-[0_8px_24px_rgba(27,36,48,0.06)]"
          >
            {t(locale, "cancel")}
          </Link>
          <button
            type="submit"
            className="min-h-12 flex-[1.4] rounded-2xl bg-accent text-sm font-semibold text-white"
          >
            {t(locale, "savePatient")}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({
  locale,
  name,
  label,
  defaultValue,
  type = "text",
  required = false,
}: {
  locale: Locale;
  name: string;
  label: MessageKey;
  defaultValue?: string | null;
  type?: "text" | "tel" | "date";
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
      {t(locale, label)}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        className={controlClass}
      />
    </label>
  );
}

function Area({
  locale,
  name,
  label,
  defaultValue,
  rows = 3,
}: {
  locale: Locale;
  name: string;
  label: MessageKey;
  defaultValue?: string | null;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
      {t(locale, label)}
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        className={`${controlClass} max-h-40 resize-y overflow-y-auto leading-6`}
      />
    </label>
  );
}

function Select({
  locale,
  name,
  label,
  value,
  options,
}: {
  locale: Locale;
  name: string;
  label: MessageKey;
  value: string;
  options: Array<[string, MessageKey]>;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
      {t(locale, label)}
      <select name={name} defaultValue={value} className={controlClass}>
        {options.map(([option, key]) => (
          <option key={option} value={option}>
            {t(locale, key)}
          </option>
        ))}
      </select>
    </label>
  );
}

const controlClass =
  "min-h-12 w-full rounded-2xl border border-line/80 bg-field px-4 text-base font-normal text-ink outline-none focus:ring-2 focus:ring-accent/30";
