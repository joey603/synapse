import { cookies } from "next/headers";

import { TaskInbox } from "@/components/tasks/TaskInbox";
import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export default async function TasksPage() {
  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[1.7rem] font-semibold leading-tight">{t(locale, "tasksTitle")}</h1>
      </header>
      <TaskInbox locale={locale} next="/tasks" />
    </div>
  );
}
