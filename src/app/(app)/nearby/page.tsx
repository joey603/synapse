import Link from "next/link";
import { cookies } from "next/headers";

import { NearbyView } from "@/components/nearby/NearbyView";
import { BackChevron } from "@/components/ui/BackChevron";
import { db } from "@/lib/db";
import { placeKey } from "@/lib/geo/place";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export default async function NearbyPage() {
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const rows = await db.patient.findMany({
    where: { status: "ACTIVE", OR: [{ address: { not: null } }, { city: { not: null } }] },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      address: true,
      city: true,
      latitude: true,
      longitude: true,
      geoKey: true,
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <Link href="/" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted">
        <BackChevron locale={locale} />
        {t(locale, "home")}
      </Link>
      <header>
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "nearbyTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t(locale, "nearbyHint")}</p>
      </header>
      <NearbyView
        locale={locale}
        needsResolve={rows.some((patient) => placeKey(patient.address, patient.city) !== patient.geoKey)}
        patients={rows.map((patient) => ({
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          address: patient.address,
          city: patient.city,
          latitude: patient.latitude,
          longitude: patient.longitude,
        }))}
      />
    </div>
  );
}
