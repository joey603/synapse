import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/locale";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  if (session.status === "invalid") redirect("/api/auth/clear");
  if (session.status !== "ok") redirect("/login");

  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);

  return (
    <AppShell locale={locale} userName={session.user.name}>
      {children}
    </AppShell>
  );
}
