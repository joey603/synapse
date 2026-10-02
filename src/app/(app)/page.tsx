import Link from "next/link";
import { cookies } from "next/headers";

import { SyncRosterFab } from "@/components/home/SyncRosterButton";
import { getSession } from "@/lib/auth/session";
import { db, withDbRetry } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export default async function HomePage() {
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const session = await getSession();
  const name = session.status === "ok" ? session.user.name : "";

  const patients = await withDbRetry(() =>
    db.patient.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ city: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        city: true,
        address: true,
        phone: true,
        contactPhone: true,
        weeklyInPersonVisits: true,
        weeklyVirtualVisits: true,
      },
    }),
  );

  const dateLabel = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="relative flex flex-1 flex-col gap-5 pb-28">
      <header>
        <p className="text-[13px] text-muted">{dateLabel.charAt(0).toLocaleUpperCase(locale === "he" ? "he-IL" : "fr-FR") + dateLabel.slice(1)}</p>
        <h1 className="mt-1 text-[1.7rem] font-semibold leading-tight tracking-tight">
          {name ? `${t(locale, "greeting")}, ${firstName(name)}` : t(locale, "greeting")}
        </h1>
      </header>

      <Link
        href="/nearby"
        className="flex items-center gap-4 rounded-synapse-md bg-card p-4 ring-1 ring-line/70 synapse-transition active:bg-surface/40"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-synapse-sm bg-terra-soft text-terra">
          <PinIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{t(locale, "nearbyTitle")}</span>
          <span className="mt-0.5 block truncate text-sm text-muted">{t(locale, "nearbyHint")}</span>
        </span>
        <ChevronIcon />
      </Link>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] font-semibold text-muted">{t(locale, "patientsTitle")}</h2>
          <p className="text-[13px] tabular-nums text-muted">{patients.length}</p>
        </div>

        {patients.length === 0 ? (
          <div className="rounded-synapse-md bg-card px-4 py-10 text-center ring-1 ring-line/70">
            <p className="text-sm font-medium text-ink">Aucun patient actif.</p>
            <p className="mt-1 text-sm text-muted">Utilise le ＋ pour coller la liste de la semaine.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-synapse-md bg-card ring-1 ring-line/70">
            {patients.map((patient, index) => {
              const label = `${patient.firstName} ${patient.lastName}`.trim();
              const phone = patient.phone ?? patient.contactPhone;
              const quotas =
                patient.weeklyInPersonVisits != null || patient.weeklyVirtualVisits != null
                  ? `${patient.weeklyInPersonVisits ?? 0}+${patient.weeklyVirtualVisits ?? 0}`
                  : null;
              return (
                <div key={patient.id}>
                  {index > 0 ? <div className="border-t border-line/70" /> : null}
                  <Link
                    href={`/patients/${patient.id}`}
                    className="flex items-start gap-3 px-4 py-3.5 active:bg-surface/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-[15px] font-semibold text-ink">{label}</span>
                        {patient.city ? <span className="text-sm text-muted">{patient.city}</span> : null}
                        {quotas ? (
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong">
                            {quotas}
                          </span>
                        ) : null}
                      </span>
                      {patient.address ? (
                        <span className="mt-0.5 block truncate text-sm text-muted">{patient.address}</span>
                      ) : null}
                      {phone ? <span className="mt-0.5 block text-sm tabular-nums text-muted">{phone}</span> : null}
                    </span>
                    <ChevronIcon />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <SyncRosterFab />
    </div>
  );
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2" fill="currentColor" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-faint rtl:rotate-180" fill="none" aria-hidden="true">
      <path d="M9.5 7.5 14 12l-4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
