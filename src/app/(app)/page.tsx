import { cookies } from "next/headers";

import { TourneeApp } from "@/components/tournee/TourneeApp";
import { resolveLocale } from "@/lib/i18n/locale";
import { loadTourneeSnapshot } from "@/lib/tournee/load";

/**
 * Accueil = Tournée branchée sur la base (patients ACTIVE + visites de la semaine).
 */
export default async function HomePage() {
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);
  const snapshot = await loadTourneeSnapshot(locale);

  return <TourneeApp initial={snapshot} />;
}
