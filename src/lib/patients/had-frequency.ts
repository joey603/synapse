export type WeeklyVisitTargets = {
  weeklyInPersonVisits: number;
  weeklyVirtualVisits: number;
};

const EMOJI_DIGITS: Record<string, string> = {
  "0️⃣": "0",
  "1️⃣": "1",
  "2️⃣": "2",
  "3️⃣": "3",
  "4️⃣": "4",
  "5️⃣": "5",
  "6️⃣": "6",
  "7️⃣": "7",
  "8️⃣": "8",
  "9️⃣": "9",
};

/** Parse a Tsabar-style weekly rhythm into numeric targets. Returns null if unknown. */
export function parseWeeklyVisitTargets(frequency: string): WeeklyVisitTargets | null {
  let text = frequency.normalize("NFKC").trim().toLowerCase();
  for (const [emoji, digit] of Object.entries(EMOJI_DIGITS)) {
    text = text.split(emoji).join(digit);
  }
  text = text.replace(/\/\s*semaine.*$/u, "").replace(/\s+/g, " ").trim();

  const plus = text.match(/^(\d+)\s*\+\s*(\d+)$/);
  if (plus) {
    return { weeklyInPersonVisits: Number(plus[1]), weeklyVirtualVisits: Number(plus[2]) };
  }

  const inPersonMatch = text.match(/(\d+)\s*(?:visites?\s+)?frontales?\b/);
  const virtualMatch = text.match(/(\d+)\s*virtuelles?\b/);
  if (inPersonMatch) {
    return {
      weeklyInPersonVisits: Number(inPersonMatch[1]),
      weeklyVirtualVisits: virtualMatch ? Number(virtualMatch[1]) : 0,
    };
  }

  const alone = text.match(/^(\d+)$/);
  if (alone) {
    return { weeklyInPersonVisits: Number(alone[1]), weeklyVirtualVisits: 0 };
  }

  return null;
}

/** Parse « Fin HAD indiquée: DD/MM » into a Date at UTC midnight for that calendar day. */
export function parsePlannedDischargeDate(
  operations: string | null,
  referenceYear: number,
): Date | null {
  if (!operations) return null;
  const match = operations.match(/Fin HAD indiquée\s*:\s*(\d{1,2})\s*\/\s*(\d{1,2})/i);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(referenceYear, month - 1, day));
  if (probe.getUTCFullYear() !== referenceYear || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return probe;
}

/** Operational note excluding structured Fin HAD lines. */
export function parseOperationalNote(operations: string | null): string | null {
  if (!operations) return null;
  const cleaned = operations
    .replace(/Fin HAD indiquée\s*:\s*\d{1,2}\s*\/\s*\d{1,2}/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .trim();
  return cleaned || null;
}

export function isOperationalContactDump(contactName: string | null): boolean {
  if (!contactName) return false;
  return /Accès\s*:|Rythme\s*:|Fin HAD|voisin/i.test(contactName);
}
