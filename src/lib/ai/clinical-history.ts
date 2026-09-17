export type HistoryMode = "all_validated";

const HISTORY_LIMIT = 24000;

/** Sélection déterministe de l’historique VALIDATED (pur, testable hors Next). */
export function selectHistory(
  reports: Array<{ text: string; at: Date; type: string }>,
  mode: HistoryMode,
) {
  if (mode !== "all_validated") return { text: "", omitted: 0 };
  const ordered = [...reports].sort((a, b) => a.at.getTime() - b.at.getTime());
  const kept: string[] = [];
  let used = 0;
  let omitted = 0;
  for (const report of [...ordered].reverse()) {
    const block = `HISTORIQUE ${report.at.toISOString().slice(0, 10)} (${report.type})\n${report.text.trim()}`;
    if (used + block.length > HISTORY_LIMIT && kept.length > 0) {
      omitted += 1;
      continue;
    }
    kept.push(block);
    used += block.length;
  }
  const note = omitted > 0 ? `Des transmissions validées plus anciennes ont été omises (${omitted}).\n` : "";
  return { text: note + kept.reverse().join("\n\n"), omitted };
}
