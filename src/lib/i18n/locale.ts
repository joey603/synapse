export const LOCALES = ["fr", "he"] as const;

export type Locale = (typeof LOCALES)[number];

export function resolveLocale(value: string | undefined): Locale {
  return value === "he" ? "he" : "fr";
}

export function directionFor(locale: Locale): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}
