import type { VisitType } from "@prisma/client";

import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { VISIT_TYPES, visitTypeLabel } from "@/lib/clinical/templates";
import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export function VisitForm({
  locale,
  action,
  patientId,
  patients,
  returnTo,
  type = "IN_PERSON",
  occurredAt,
  notes,
  error,
  submitLabel,
  dockSubmit = false,
}: {
  locale: Locale;
  action: string;
  patientId?: string;
  patients?: {
    id: string;
    firstName: string;
    lastName: string;
    city: string | null;
    weekLabel?: string | null;
  }[];
  returnTo?: string;
  type?: VisitType;
  occurredAt: string;
  notes?: string | null;
  error?: "invalid" | "save" | null;
  submitLabel: string;
  /** Colle le bouton d’envoi en bas, juste au-dessus de la barre de navigation. */
  dockSubmit?: boolean;
}) {
  return (
    <form
      action={action}
      method="post"
      className="flex flex-col gap-4"
    >
      {patientId ? <input type="hidden" name="patientId" value={patientId} /> : null}
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      {patients ? (
        <SurfaceCard className="p-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            {t(locale, "agendaPatient")}
            <select
              name="patientId"
              required
              defaultValue=""
              className="min-h-12 rounded-2xl border border-line/80 bg-field px-4 text-base font-normal outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="" disabled>
                {t(locale, "agendaChoose")}
              </option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.firstName} {patient.lastName}
                  {patient.city ? ` · ${patient.city}` : ""}
                  {patient.weekLabel ? ` · ${patient.weekLabel}` : ""}
                </option>
              ))}
            </select>
          </label>
        </SurfaceCard>
      ) : null}
      {error ? (
        <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm leading-6 text-danger" role="alert">
          {t(locale, error === "save" ? "formSaveError" : "formVisitInvalid")}
        </p>
      ) : null}

      <SurfaceCard>
        {VISIT_TYPES.map((option, index) => (
          <label
            key={option}
            className={`flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3 has-[:checked]:bg-accent-soft ${
              index > 0 ? "border-t border-line/70" : ""
            }`}
          >
            <input
              type="radio"
              name="type"
              value={option}
              defaultChecked={option === type}
              className="h-4 w-4 accent-accent"
            />
            <span className="text-[15px] font-semibold text-ink">{t(locale, visitTypeLabel(option))}</span>
          </label>
        ))}
      </SurfaceCard>

      <SurfaceCard className="flex flex-col gap-4 p-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          {t(locale, "visitWhen")}
          <input
            type="datetime-local"
            name="occurredAt"
            required
            defaultValue={occurredAt}
            className="min-h-12 rounded-2xl border border-line/80 bg-field px-4 text-base font-normal outline-none focus:ring-2 focus:ring-accent/30"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          {t(locale, "visitNotes")}
          <textarea
            name="notes"
            rows={3}
            defaultValue={notes ?? ""}
            placeholder={t(locale, "visitNotesHint")}
            className="h-24 max-h-24 resize-none overflow-y-auto rounded-2xl border border-line/80 bg-field px-4 py-3 text-base font-normal leading-6 outline-none placeholder:text-faint focus:ring-2 focus:ring-accent/30"
          />
        </label>
      </SurfaceCard>

      <div
        className={
          dockSubmit
            ? "pointer-events-none fixed inset-x-0 bottom-[calc(5.15rem+env(safe-area-inset-bottom))] z-20 mx-auto w-full max-w-lg px-5"
            : "sticky bottom-0 z-10 -mx-5 bg-surface px-5 pb-1 pt-2"
        }
      >
        <button
          type="submit"
          className={`min-h-12 w-full rounded-2xl bg-accent text-sm font-semibold text-white ${
            dockSubmit ? "pointer-events-auto shadow-nav" : ""
          }`}
        >
          {submitLabel}
        </button>
      </div>
      {dockSubmit ? <div className="h-16 shrink-0" aria-hidden /> : null}
    </form>
  );
}
