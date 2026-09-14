import Link from "next/link";

export type AnalysisMark = "denied" | "present" | "missing" | "uncertain";

export type AnalysisRow = {
  id: string;
  label: string;
  mark: AnalysisMark;
  status: string;
  value: string | null;
  quote: string | null;
  evidenceNote: string | null;
  sourceHref: string | null;
  sourceLabel: string;
  historical: boolean;
};

export function AnalysisView({
  alertsTitle,
  alerts,
  sections,
  meds,
  changes,
}: {
  alertsTitle: string;
  alerts: string[];
  sections: Array<{
    id: string;
    title: string;
    open: boolean;
    empty: string;
    rows: AnalysisRow[];
    folded?: AnalysisRow[];
    foldedTitle?: string;
  }>;
  meds: {
    title: string;
    chartTitle: string;
    mentionedTitle: string;
    changesTitle: string;
    emptyChart: string;
    emptyMentions: string;
    chart: Array<{ name: string; dose: string | null }>;
    rows: Array<{ tone: "match" | "absent" | "change" | "uncertain"; name: string; detail: string | null; label: string }>;
  } | null;
  changes: {
    title: string;
    before: string;
    today: string;
    empty: string;
    notComparable: string;
    rows: Array<{ id: string; label: string; from: string; to: string; historical: boolean; incomparable?: boolean }>;
  } | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      {alerts.length > 0 ? (
        <section className="rounded-3xl bg-danger-soft px-4 py-4">
          <h2 className="text-sm font-semibold text-danger">{alertsTitle}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {alerts.map((item) => (
              <li key={item} className="text-sm leading-6 text-danger">
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sections.map((section) => (
        <details key={section.id} open={section.open} className="rounded-3xl bg-card shadow-[0_8px_24px_rgba(27,36,48,0.06)]">
          <summary className="cursor-pointer list-none px-4 py-4 text-[15px] font-semibold text-ink">
            {section.title}
          </summary>
          <div className="flex flex-col border-t border-line/70">
            {section.rows.length === 0 ? <p className="px-4 py-3 text-sm text-muted">{section.empty}</p> : null}
            {section.rows.map((row) => (
              <FactRow key={row.id} row={row} />
            ))}
            {section.folded && section.folded.length > 0 ? (
              <details className="border-t border-line/70">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted">
                  {section.foldedTitle}
                </summary>
                {section.folded.map((row) => (
                  <FactRow key={row.id} row={row} />
                ))}
              </details>
            ) : null}
          </div>
        </details>
      ))}

      {meds ? (
        <details open className="rounded-3xl bg-card shadow-[0_8px_24px_rgba(27,36,48,0.06)]">
          <summary className="cursor-pointer list-none px-4 py-4 text-[15px] font-semibold text-ink">{meds.title}</summary>
          <div className="flex flex-col gap-4 border-t border-line/70 px-4 py-4">
            <div>
              <h3 className="text-xs font-semibold text-muted">{meds.chartTitle}</h3>
              {meds.chart.length === 0 ? <p className="mt-1 text-sm text-muted">{meds.emptyChart}</p> : null}
              <ul className="mt-1 flex flex-col gap-1">
                {meds.chart.map((item) => (
                  <li key={item.name} className="text-sm text-ink">
                    {item.name}
                    {item.dose ? ` ${item.dose}` : ""}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-muted">{meds.mentionedTitle}</h3>
              {meds.rows.length === 0 ? <p className="mt-1 text-sm text-muted">{meds.emptyMentions}</p> : null}
              <ul className="mt-2 flex flex-col gap-2">
                {meds.rows.map((row) => (
                  <li key={`${row.tone}-${row.name}`} className="text-sm leading-6 text-ink">
                    <span className="font-medium">{row.name}</span>
                    {row.detail ? <span className="text-muted"> — {row.detail}</span> : null}
                    <span className="mt-0.5 block text-xs text-muted">{row.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            {meds.rows.some((row) => row.tone === "change") ? (
              <p className="text-xs font-semibold text-danger">{meds.changesTitle}</p>
            ) : null}
          </div>
        </details>
      ) : null}

      {changes ? (
        <details open className="rounded-3xl bg-card shadow-[0_8px_24px_rgba(27,36,48,0.06)]">
          <summary className="cursor-pointer list-none px-4 py-4 text-[15px] font-semibold text-ink">{changes.title}</summary>
          <div className="flex flex-col border-t border-line/70">
            {changes.rows.length === 0 ? <p className="px-4 py-3 text-sm text-muted">{changes.empty}</p> : null}
            {changes.rows.map((row) => (
              <div key={row.id} className="border-t border-line/70 px-4 py-3 first:border-t-0">
                <p className="text-sm font-semibold text-ink">{row.label}</p>
                {row.incomparable ? (
                  <p className="mt-1 text-sm text-muted">{changes.notComparable}</p>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-muted">
                      {changes.before}: {row.from}
                    </p>
                    <p className="text-sm text-ink">
                      {changes.today}: {row.to}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function FactRow({ row }: { row: AnalysisRow }) {
  return (
    <div className="border-t border-line/70 px-4 py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink">
          <span className="me-1" aria-hidden="true">
            {markGlyph(row.mark)}
          </span>
          {row.label}
        </p>
      </div>
      <p className={`mt-1 text-sm leading-6 ${row.historical ? "text-muted" : "text-ink"}`}>{row.status}</p>
      {row.value ? <p className="mt-1 text-sm leading-6 text-ink">{row.value}</p> : null}
      {row.evidenceNote ? <p className="mt-1 text-xs leading-5 text-muted">{row.evidenceNote}</p> : null}
      {row.quote && row.sourceHref ? (
        <Link href={row.sourceHref} className="mt-1 inline-flex text-xs font-semibold text-accent">
          {row.sourceLabel}
        </Link>
      ) : null}
    </div>
  );
}

function markGlyph(mark: AnalysisMark) {
  if (mark === "denied") return "✓";
  if (mark === "present") return "●";
  if (mark === "uncertain") return "⚠";
  return "?";
}
