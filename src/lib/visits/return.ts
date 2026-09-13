export function agendaReturnPath(value: FormDataEntryValue | null) {
  if (value === "/agenda") return "/agenda";
  if (typeof value !== "string" || !value.startsWith("/agenda?")) return null;
  const params = new URLSearchParams(value.slice("/agenda?".length));
  const day = params.get("day");
  const month = params.get("month");
  if (params.get("edit")) return null;
  if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  if (month && !/^\d{4}-\d{2}$/.test(month)) return null;
  if ([...params.keys()].some((key) => key !== "day" && key !== "month")) return null;
  const next = new URLSearchParams();
  if (month) next.set("month", month);
  if (day) next.set("day", day);
  const query = next.toString();
  return query ? `/agenda?${query}` : "/agenda";
}

export function withQuery(path: string, key: string, value: string) {
  const url = new URL(path, "http://local");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}
