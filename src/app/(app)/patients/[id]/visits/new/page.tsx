import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { BackChevron } from "@/components/ui/BackChevron";
import { VisitForm } from "@/components/visits/VisitForm";
import { db } from "@/lib/db";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";
import { jerusalemNowInput } from "@/lib/visits/time";

export default async function NewVisitPage({
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
  const patient = await db.patient.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!patient) notFound();

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/patients/${id}?tab=timeline`} className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted">
        <BackChevron locale={locale} />
        {patient.firstName} {patient.lastName}
      </Link>
      <header>
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "newVisit")}</h1>
        <p className="mt-1 text-sm text-muted">{t(locale, "newVisitHint")}</p>
      </header>
      <VisitForm
        locale={locale}
        action="/api/visits"
        patientId={patient.id}
        occurredAt={jerusalemNowInput()}
        error={error === "save" ? "save" : error === "invalid" ? "invalid" : null}
        submitLabel={t(locale, "createVisit")}
      />
    </div>
  );
}
