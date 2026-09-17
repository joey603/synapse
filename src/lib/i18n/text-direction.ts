/**
 * Direction for mixed French / Hebrew clinical text fields.
 * Prefer content-based detection over the UI locale.
 */

const RLI = "\u2067";
const PDI = "\u2069";
const LRM = "\u200E";
const BIDI_MARKS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const RTL_RUN =
  /[\u0590-\u05FF\uFB1D-\uFB4F]+(?:[\s\u00A0]+[\u0590-\u05FF\uFB1D-\uFB4F]+)*/g;

export function textDirection(value: string, fallback: "ltr" | "rtl" = "ltr"): "ltr" | "rtl" {
  for (const char of value) {
    const code = char.codePointAt(0);
    if (code == null) continue;
    if (isRtlLetter(code)) return "rtl";
    if (isLtrLetter(code)) return "ltr";
  }
  return fallback;
}

function isRtlLetter(code: number) {
  return (
    (code >= 0x0590 && code <= 0x05ff) ||
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0xfb1d && code <= 0xfb4f)
  );
}

function isLtrLetter(code: number) {
  return (
    (code >= 0x0041 && code <= 0x005a) ||
    (code >= 0x0061 && code <= 0x007a) ||
    (code >= 0x00c0 && code <= 0x024f)
  );
}

export type BidiRun = { dir: "ltr" | "rtl"; text: string };

/** Split mixed FR/HE text into directional runs (Hebrew sequences isolated). */
export function splitBidiRuns(value: string): BidiRun[] {
  const clean = stripBidiMarks(value);
  const base = textDirection(clean);
  const runs: BidiRun[] = [];
  let cursor = 0;
  for (const match of clean.matchAll(RTL_RUN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      runs.push({ dir: "ltr", text: clean.slice(cursor, index) });
    }
    runs.push({ dir: "rtl", text: match[0]! });
    cursor = index + match[0]!.length;
  }
  if (cursor < clean.length) {
    runs.push({ dir: "ltr", text: clean.slice(cursor) });
  }
  if (runs.length === 0) return [{ dir: base, text: clean }];
  return runs;
}

/** Insert Unicode isolates so Hebrew stays in place inside French (textarea-safe). */
export function wrapRtlIsolates(value: string) {
  const clean = stripBidiMarks(value);
  if (textDirection(clean) === "rtl") return clean;
  return clean.replace(RTL_RUN, `${RLI}$&${PDI}${LRM}`);
}

export function stripBidiMarks(value: string) {
  return value.replace(BIDI_MARKS, "");
}

/** Shared classes for clinical textareas / previews with mixed scripts. */
export const BIDI_TEXT_CLASS = "whitespace-pre-wrap text-start [unicode-bidi:isolate]";
