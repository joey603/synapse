const TIME_ZONE = "Asia/Jerusalem";

export function jerusalemNowInput(now = new Date()) {
  return formatJerusalemInput(now);
}

export function formatJerusalemInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  const hour = value("hour") === "24" ? "00" : value("hour");
  return `${value("year")}-${value("month")}-${value("day")}T${hour}:${value("minute")}`;
}

export function parseJerusalemInput(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59) return null;

  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const corrected = wall - jerusalemOffsetMs(new Date(wall));
  return new Date(wall - jerusalemOffsetMs(new Date(corrected)));
}

export function jerusalemDateKey(date: Date) {
  return formatJerusalemInput(date).slice(0, 10);
}

export function isJerusalemDayKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 2000 || year > 2100) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
  );
}

export function shiftJerusalemDay(key: string, days: number) {
  if (!isJerusalemDayKey(key)) return null;
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12, 0));
  return jerusalemDateKey(shifted);
}

export function jerusalemDayBoundsFor(key: string) {
  if (!isJerusalemDayKey(key)) return null;
  const start = parseJerusalemInput(`${key}T00:00`);
  const next = shiftJerusalemDay(key, 1);
  const end = next ? parseJerusalemInput(`${next}T00:00`) : null;
  if (!start || !end) return null;
  return { start, end };
}

export function jerusalemDayBounds(now = new Date()) {
  const bounds = jerusalemDayBoundsFor(jerusalemDateKey(now));
  if (!bounds) return { start: now, end: now };
  return bounds;
}

function jerusalemOffsetMs(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const hour = value("hour") === 24 ? 0 : value("hour");
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), hour, value("minute"), value("second"));
  return asUtc - date.getTime();
}
