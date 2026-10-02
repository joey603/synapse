import {
  formatRosterPhone,
  normalizePhoneDigits,
  type RosterPatient,
} from "@/lib/patients/tournee-roster";

const EMOJI_DIGIT: Record<string, number> = {
  "0️⃣": 0,
  "1️⃣": 1,
  "2️⃣": 2,
  "3️⃣": 3,
  "4️⃣": 4,
  "5️⃣": 5,
  "6️⃣": 6,
  "7️⃣": 7,
  "8️⃣": 8,
  "9️⃣": 9,
};

const CITY_ALIASES: Record<string, string> = {
  lod: "לוד",
  ramle: "רמלה",
  ramla: "רמלה",
  "rishon lezion": "ראשון לציון",
  "rishon letzion": "ראשון לציון",
  ashdod: "אשדוד",
  yavne: "יבנה",
  "ness ziona": "נס ציונה",
  "nes ziona": "נס ציונה",
  "ganei hadar": "גני הדר",
  bitzaron: "ביצרון",
  mazliach: "מצליח",
};

const CONTACT_LABEL =
  /^(épouse|epouse|mari|בעל|אשה|voisin|voisinee|voisin\/e|shmouel|shmuel|contact|père|mere|mère|fils|fille|maman|papa)\b/i;

const ACCESS_HINT =
  /קומה|דירה|דלת|קוד|code|🔑|#\d|étage|etage|כניסה|דירת/i;

const ADDRESS_HINT = /רחוב|שד'|שדרות|יער|מוהליבר|לבונטין|מבצע|הפזית|המגילה|street|rue\b/i;

const ACCESS_SPLIT =
  /\s+(?=(?:קומה|דירה|דלת|קוד|🔑|כניסה|#\d+|code|étage|etage)(?:\s|$))/iu;

const SKIP_HEADER =
  /^(ariel|tsabar|nombre patients|patients\s*:)/i;

function emojiToNumber(token: string) {
  for (const [emoji, digit] of Object.entries(EMOJI_DIGIT)) {
    if (token.includes(emoji)) return digit;
  }
  const plain = token.replace(/[^\d]/g, "");
  if (!plain) return null;
  return Number(plain);
}

function parseQuotas(line: string) {
  const pair = line.match(
    /(0️⃣|1️⃣|2️⃣|3️⃣|4️⃣|5️⃣|6️⃣|7️⃣|8️⃣|9️⃣)\s*[+＋]\s*(0️⃣|1️⃣|2️⃣|3️⃣|4️⃣|5️⃣|6️⃣|7️⃣|8️⃣|9️⃣)/u,
  );
  if (pair) {
    return {
      home: emojiToNumber(pair[1]) ?? 0,
      phone: emojiToNumber(pair[2]) ?? 0,
      raw: pair[0],
    };
  }
  const single = line.match(/(0️⃣|1️⃣|2️⃣|3️⃣|4️⃣|5️⃣|6️⃣|7️⃣|8️⃣|9️⃣)/u);
  if (single) {
    return { home: emojiToNumber(single[1]) ?? 0, phone: 0, raw: single[1] };
  }
  return { home: 0, phone: 0, raw: "" };
}

function stripDecorations(line: string) {
  return line
    .replace(/[👥👤🇮🇱🚨🧭]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCity(line: string) {
  const hebrewCities = line.match(/[\u0590-\u05FF][\u0590-\u05FF\s''׳״-]{1,40}/g);
  if (hebrewCities?.length) {
    const candidate = hebrewCities[hebrewCities.length - 1].trim();
    if (candidate.length >= 2) return candidate;
  }
  const lower = line.toLowerCase();
  for (const [alias, city] of Object.entries(CITY_ALIASES)) {
    if (lower.includes(alias)) return city;
  }
  return "";
}

function isVisitLine(line: string) {
  const t = line.trim();
  if (/^-\s*\[[ xX✓✔]?\]/.test(t)) return true;
  if (/^(?:-\s*)?(?:🏡|☎️)/.test(t)) return true;
  if (/\bprévu\b|\bprevu\b/i.test(t) && /🏡|☎️|-\s*\[/.test(t)) return true;
  return false;
}

function isPhoneOnlyLine(line: string) {
  const cleaned = line.replace(/[^\d+]/g, "");
  const digits = normalizePhoneDigits(line);
  if (digits.length < 9 || digits.length > 12) return false;
  // Mostly phone characters
  const letters = line.replace(/[\d\s+\-().]/g, "").trim();
  return letters.length <= 2 || CONTACT_LABEL.test(line.trim());
}

function extractPhonesFromLine(line: string) {
  const matches = line.match(/(?:\+?972[\s-]*)?0?\d[\d\s-]{7,12}\d/g) ?? [];
  return matches.map(formatRosterPhone).filter((p) => p.length >= 9);
}

function isHeaderLine(line: string) {
  const t = line.trim();
  if (!t || SKIP_HEADER.test(t)) return false;
  if (isVisitLine(t)) return false;
  if (/^nombre\b/i.test(t)) return false;
  // Strict: numéro de fiche (01-Name) OU présence d'un quota emoji
  if (/^\d{1,2}\s*[-–.]/.test(t)) return true;
  if (/(0️⃣|1️⃣|2️⃣|3️⃣|4️⃣|5️⃣|6️⃣|7️⃣|8️⃣|9️⃣)/u.test(t) && /[A-Za-z\u00C0-\u017F]{2,}/.test(t)) {
    return true;
  }
  return false;
}

function parseHeader(line: string, index: number): Omit<RosterPatient, "address" | "accessInstructions" | "phones" | "contactName" | "contactPhone" | "note"> & {
  restLine: string;
} {
  let working = stripDecorations(line);
  const quotas = parseQuotas(working);
  if (quotas.raw) {
    working = working.replace(new RegExp(quotas.raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), " ");
  }
  working = working.replace(/\b\d{1,2}\s*[-/]\s*\d{1,2}\b/g, " ").replace(/\s+/g, " ").trim();

  const city = extractCity(working);
  if (city) {
    working = working.replace(city, " ").replace(/\s+/g, " ").trim();
    // also strip latin alias if present
    for (const alias of Object.keys(CITY_ALIASES)) {
      working = working.replace(new RegExp(alias, "ig"), " ");
    }
    working = working.replace(/\s+/g, " ").trim();
  }

  working = working.replace(/^\d{1,2}\s*[-–.]?\s*/, "").trim();
  working = working.replace(/[🇮🇱🚨]+/g, "").trim();

  const nameParts = working.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ? capitalize(nameParts[0]) : `Patient${index + 1}`;
  const lastName = nameParts.slice(1).map(capitalize).join(" ");

  return {
    key: `${String(index + 1).padStart(2, "0")}-${firstName.toLowerCase()}-${(city || "x").slice(0, 12)}`,
    firstName,
    lastName,
    city: city || "—",
    homeQuota: quotas.home,
    phoneQuota: quotas.phone,
    restLine: working,
  };
}

function capitalize(value: string) {
  if (!value) return value;
  if (/^[\u0590-\u05FF]/.test(value)) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export type ParseTourneeListResult = {
  patients: RosterPatient[];
  skippedLines: number;
  errors: string[];
};

export function parseTourneeList(raw: string): ParseTourneeListResult {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const patients: RosterPatient[] = [];
  const errors: string[] = [];
  let skippedLines = 0;

  let current: {
    header: ReturnType<typeof parseHeader>;
    addressLines: string[];
    accessLines: string[];
    phones: string[];
    contactName: string | null;
    contactPhone: string | null;
    notes: string[];
  } | null = null;

  function flush() {
    if (!current) return;
    const phones = [...new Set(current.phones.map(normalizePhoneDigits).filter((p) => p.length >= 9))].map(
      formatRosterPhone,
    );
    if (!current.header.firstName) {
      errors.push(`Entrée ignorée (sans nom) : ${current.header.key}`);
      current = null;
      return;
    }
    if (!phones.length && !current.contactPhone) {
      errors.push(`${current.header.firstName} : aucun téléphone détecté`);
    }
    const address = current.addressLines.join(", ").trim();
    const access = current.accessLines.join(", ").trim() || null;
    const note = current.notes.join(" · ").trim() || null;
    // Ne jamais recopier la ville dans address → évite « אשדוד, אשדוד ».
    patients.push({
      key: current.header.key,
      firstName: current.header.firstName,
      lastName: current.header.lastName,
      city: current.header.city,
      address,
      accessInstructions: access,
      phones,
      contactName: current.contactName,
      contactPhone: current.contactPhone,
      homeQuota: current.header.homeQuota,
      phoneQuota: current.header.phoneQuota,
      note,
    });
    current = null;
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (SKIP_HEADER.test(line) || /^nombre patients/i.test(line)) {
      skippedLines += 1;
      continue;
    }
    if (isVisitLine(line)) {
      skippedLines += 1;
      continue;
    }

    if (isHeaderLine(line)) {
      flush();
      current = {
        header: parseHeader(line, patients.length),
        addressLines: [],
        accessLines: [],
        phones: [],
        contactName: null,
        contactPhone: null,
        notes: [],
      };
      continue;
    }

    if (!current) {
      skippedLines += 1;
      continue;
    }

    const phonesInLine = extractPhonesFromLine(line);
    if (phonesInLine.length && (isPhoneOnlyLine(line) || CONTACT_LABEL.test(line))) {
      if (CONTACT_LABEL.test(line)) {
        const label = line.replace(/(?:\+?972[\s-]*)?0?\d[\d\s-]{7,12}\d/g, "").replace(/[:\-–]/g, " ").trim();
        current.contactName = label || current.contactName || "Contact";
        current.contactPhone = phonesInLine[0];
        if (phonesInLine.length > 1) current.phones.push(...phonesInLine.slice(1));
      } else {
        current.phones.push(...phonesInLine);
      }
      continue;
    }

    if (phonesInLine.length && !ADDRESS_HINT.test(line) && !ACCESS_HINT.test(line)) {
      // e.g. "Shmouel" then phones on next lines already handled; or "name phone"
      if (/[A-Za-z\u0590-\u05FF]{2,}/.test(line) && phonesInLine.length === 1 && line.length < 40) {
        const label = line.replace(/(?:\+?972[\s-]*)?0?\d[\d\s-]{7,12}\d/g, "").trim();
        if (label && !current.contactName) {
          current.contactName = label;
          current.contactPhone = phonesInLine[0];
          continue;
        }
      }
      current.phones.push(...phonesInLine);
      continue;
    }

    // Rue d’abord : une ligne « רחוב … קומה … » ne doit pas tout partir en accès.
    if (ADDRESS_HINT.test(line)) {
      const { street, access } = splitStreetAndAccess(line);
      if (street) current.addressLines.push(street);
      if (access) current.accessLines.push(access);
      continue;
    }

    if (ACCESS_HINT.test(line)) {
      current.accessLines.push(line);
      continue;
    }

    if (/[\u0590-\u05FF]/.test(line)) {
      if (!current.addressLines.length) {
        current.addressLines.push(line);
      } else if (ACCESS_HINT.test(line)) {
        current.accessLines.push(line);
      } else {
        current.addressLines.push(line);
      }
      continue;
    }

    if (/vacances|voisin|attention|🚨/i.test(line)) {
      current.notes.push(line.replace(/🚨/g, "").trim());
      continue;
    }

    // leftover text without phones
    if (line.length > 2) current.notes.push(line);
  }

  flush();

  return { patients, skippedLines, errors };
}

/** Sépare « רחוב X 14 אשדוד קומה 2 דירה 13 » → rue + accès. */
export function splitStreetAndAccess(line: string) {
  const cleaned = line.trim();
  if (!ADDRESS_HINT.test(cleaned)) {
    return { street: "", access: cleaned };
  }
  const parts = cleaned.split(ACCESS_SPLIT);
  const street = (parts[0] ?? "").trim();
  const access = parts.slice(1).join(" ").replace(/\s+/g, " ").trim();
  if (street.length >= 3) return { street, access };
  return { street: cleaned, access: "" };
}
