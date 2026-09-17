import { BIDI_TEXT_CLASS, splitBidiRuns, textDirection } from "@/lib/i18n/text-direction";

/** Read-only clinical text with Hebrew runs isolated inside French (or the reverse). */
export function BidiRichText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const base = textDirection(text);
  const runs = splitBidiRuns(text);

  return (
    <div
      dir={base}
      lang={base === "rtl" ? "he" : "fr"}
      className={`${BIDI_TEXT_CLASS} ${className}`.trim()}
    >
      {runs.map((run, index) =>
        run.dir === base ? (
          <span key={index}>{run.text}</span>
        ) : (
          <span key={index} dir={run.dir} className="[unicode-bidi:isolate]">
            {run.text}
          </span>
        ),
      )}
    </div>
  );
}
