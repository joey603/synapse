import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";
import {
  hasHadProgress,
  type WeeklyChannelProgress,
  type WeeklyHadProgress,
} from "@/lib/visits/had-week";

export function WeeklyHadCard({
  locale,
  progress,
}: {
  locale: Locale;
  progress: WeeklyHadProgress | null | undefined;
}) {
  if (!hasHadProgress(progress)) return null;
  return (
    <div className="rounded-2xl bg-card px-4 py-4 ring-1 ring-line">
      <p className="text-sm font-semibold text-muted">{t(locale, "hadWeekTitle")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {progress!.inPerson.target != null ? (
          <ChannelCard locale={locale} labelKey="hadWeekInPerson" channel={progress!.inPerson} />
        ) : null}
        {progress!.virtual.target != null ? (
          <ChannelCard locale={locale} labelKey="hadWeekVirtual" channel={progress!.virtual} />
        ) : null}
      </div>
    </div>
  );
}

export function WeeklyHadInline({
  locale,
  progress,
}: {
  locale: Locale;
  progress: WeeklyHadProgress | null | undefined;
}) {
  const text = weeklyHadShortLabel(locale, progress);
  if (!text) return null;
  return <span className="text-sm tabular-nums text-muted">{text}</span>;
}

/** Suffixe compact pour listes / select Agenda : « Frontales 1/2 · Virtuelles 0/1 ». */
export function weeklyHadShortLabel(locale: Locale, progress: WeeklyHadProgress | null | undefined) {
  if (!hasHadProgress(progress)) return null;
  const parts: string[] = [];
  if (progress!.inPerson.target != null) {
    parts.push(`${t(locale, "hadWeekInPerson")} ${progress!.inPerson.done}/${progress!.inPerson.target}`);
  }
  if (progress!.virtual.target != null) {
    parts.push(`${t(locale, "hadWeekVirtual")} ${progress!.virtual.done}/${progress!.virtual.target}`);
  }
  return parts.join(" · ");
}

function ChannelCard({
  locale,
  labelKey,
  channel,
}: {
  locale: Locale;
  labelKey: "hadWeekInPerson" | "hadWeekVirtual";
  channel: WeeklyChannelProgress;
}) {
  const remaining =
    channel.remaining === 0
      ? t(locale, "hadWeekComplete")
      : t(locale, "hadWeekRemaining").replace("{n}", String(channel.remaining));
  return (
    <div className="rounded-xl bg-surface px-3 py-3">
      <p className="text-xs font-medium text-muted">{t(locale, labelKey)}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
        {channel.done}/{channel.target}
      </p>
      <p className="mt-0.5 text-xs text-muted">{remaining}</p>
    </div>
  );
}
