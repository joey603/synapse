import { EmptyState } from "@/components/ui/EmptyState";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

type TaskRow = {
  id: string;
  title: string;
  status: "TODO" | "WAITING" | "DONE";
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  dueDate: Date | null;
};

export function TaskPanel({
  locale,
  patientId,
  visitId,
  tasks,
  next,
}: {
  locale: Locale;
  patientId: string;
  visitId?: string;
  tasks: TaskRow[];
  next: string;
}) {
  const ordered = [...tasks.filter((task) => task.status !== "DONE"), ...tasks.filter((task) => task.status === "DONE")];

  return (
    <section className="flex flex-col gap-3">
      {ordered.length === 0 ? <EmptyState title={t(locale, "tasksEmpty")} body={t(locale, "homeTasksHint")} /> : null}
      {ordered.length > 0 ? (
        <SurfaceCard>
          {ordered.map((task, index) => {
            const done = task.status === "DONE";
            return (
              <div key={task.id} id={`task-${task.id}`}>
                {index > 0 ? <div className="border-t border-line/70" /> : null}
                <div className={`flex items-center gap-3 px-4 py-3 ${done ? "opacity-60" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[15px] font-semibold ${done ? "text-faint line-through" : "text-ink"}`}>{task.title}</p>
                    <p className={`truncate text-sm ${done ? "text-faint line-through" : "text-muted"}`}>
                      {task.dueDate
                        ? new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
                            timeZone: "Asia/Jerusalem",
                            day: "numeric",
                            month: "short",
                          }).format(task.dueDate)
                        : t(locale, "taskOpen")}
                      {task.priority !== "NORMAL" ? ` · ${t(locale, task.priority === "URGENT" ? "priorityUrgent" : "priorityImportant")}` : ""}
                      {task.status === "WAITING" ? ` · ${t(locale, "taskWaiting")}` : ""}
                    </p>
                  </div>
                  <form action={`/api/tasks/${task.id}/done`} method="post">
                    <input type="hidden" name="next" value={next} />
                    <button
                      className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${done ? "bg-surface text-muted" : "bg-terra text-white"}`}
                    >
                      {t(locale, done ? "taskReopen" : "taskDone")}
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </SurfaceCard>
      ) : null}
      <details className="rounded-2xl bg-terra-soft">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center px-3 text-sm font-semibold text-terra [&::-webkit-details-marker]:hidden">
          {t(locale, "addTask")}
        </summary>
        <form action={`/api/patients/${patientId}/tasks`} method="post" className="flex flex-col gap-2 px-3 pb-3">
          {visitId ? <input type="hidden" name="visitId" value={visitId} /> : null}
          <input type="hidden" name="next" value={next} />
          <input name="title" required maxLength={160} placeholder={t(locale, "eventTitle")} className="min-h-11 rounded-xl bg-field px-3 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <select name="priority" className="min-h-11 rounded-xl bg-field px-2 text-sm">
              <option value="NORMAL">{t(locale, "priorityNormal")}</option>
              <option value="IMPORTANT">{t(locale, "priorityImportant")}</option>
              <option value="URGENT">{t(locale, "priorityUrgent")}</option>
            </select>
            <input name="dueDate" type="date" className="min-h-11 rounded-xl bg-field px-2 text-sm" />
          </div>
          <button className="min-h-11 rounded-xl bg-terra text-sm font-semibold text-white">{t(locale, "addTask")}</button>
        </form>
      </details>
    </section>
  );
}
