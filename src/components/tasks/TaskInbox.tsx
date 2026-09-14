import Link from "next/link";

import { EmptyState } from "@/components/ui/EmptyState";
import { SurfaceCard } from "@/components/ui/SurfaceCard";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/locale";
import { t, type MessageKey } from "@/lib/i18n/messages";
import { jerusalemDateKey } from "@/lib/visits/time";

export async function TaskInbox({ locale, next }: { locale: Locale; next: string }) {
  const today = jerusalemDateKey(new Date());
  const tasks = await db.task.findMany({
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: 80,
    include: { patient: { select: { firstName: true, lastName: true } } },
  });
  const waiting = tasks.filter((task) => task.status === "WAITING");
  const done = tasks.filter((task) => task.status === "DONE");
  const open = tasks.filter((task) => task.status === "TODO");
  const groups = [
    { id: "overdue", label: "tasksOverdue" as const, rows: open.filter((task) => task.dueDate && day(task.dueDate) < today) },
    { id: "today", label: "agendaToday" as const, rows: open.filter((task) => task.dueDate && day(task.dueDate) === today) },
    { id: "upcoming", label: "tasksUpcoming" as const, rows: open.filter((task) => !task.dueDate || day(task.dueDate) > today) },
    { id: "waiting", label: "taskWaiting" as const, rows: waiting },
    { id: "done", label: "taskFinished" as const, rows: done },
  ].filter((group) => group.rows.length > 0);

  if (groups.length === 0) return <EmptyState title={t(locale, "tasksEmpty")} body={t(locale, "homeTasksHint")} />;

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.id} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted">{t(locale, group.label)}</h2>
          <SurfaceCard>
            {group.rows.map((task, index) => (
              <div key={task.id}>
                {index > 0 ? <div className="border-t border-line/70" /> : null}
                <div className={`flex items-center gap-3 px-4 py-3 ${task.status === "DONE" ? "opacity-60" : ""}`}>
                  <Link href={`/patients/${task.patientId}?tab=tasks#task-${task.id}`} className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] font-semibold ${task.status === "DONE" ? "text-faint line-through" : "text-ink"}`}>
                      {task.title}
                    </span>
                    <span className={`block truncate text-sm ${task.status === "DONE" ? "text-faint line-through" : "text-muted"}`}>
                      {task.patient.firstName} {task.patient.lastName}
                      {task.dueDate ? ` · ${formatDay(task.dueDate, locale)}` : ""}
                      {task.priority !== "NORMAL" ? ` · ${t(locale, priorityKey(task.priority))}` : ""}
                    </span>
                  </Link>
                  <form action={`/api/tasks/${task.id}/done`} method="post">
                    <input type="hidden" name="next" value={next} />
                    <button
                      className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${task.status === "DONE" ? "bg-surface text-muted" : "bg-accent text-white"}`}
                    >
                      {t(locale, task.status === "DONE" ? "taskReopen" : "taskDone")}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </SurfaceCard>
        </section>
      ))}
    </div>
  );
}

function day(date: Date) {
  return jerusalemDateKey(date);
}

function formatDay(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "fr-FR", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "short",
  }).format(date);
}

function priorityKey(priority: "NORMAL" | "IMPORTANT" | "URGENT"): MessageKey {
  if (priority === "URGENT") return "priorityUrgent";
  if (priority === "IMPORTANT") return "priorityImportant";
  return "priorityNormal";
}
