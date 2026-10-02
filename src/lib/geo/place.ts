import "server-only";

import { createHash } from "node:crypto";

export function placeQuery(address: string | null, city: string | null) {
  const street = cleanPlacePart(address);
  const town = cleanPlacePart(city);
  if (!street && !town) return null;
  // Évite « אשדוד, אשדוד, Israel » quand address = city.
  if (street && town && (street === town || street.endsWith(town))) {
    return `${street}, Israel`.slice(0, 240);
  }
  return [street, town, "Israel"].filter(Boolean).join(", ").slice(0, 240);
}

export function placeKey(address: string | null, city: string | null) {
  const query = placeQuery(address, city);
  if (!query) return null;
  return createHash("sha256").update(query).digest("hex").slice(0, 24);
}

function cleanPlacePart(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[🚨🧭🔑👥👤🇮🇱]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
