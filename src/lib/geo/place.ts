import "server-only";

import { createHash } from "node:crypto";

export function placeQuery(address: string | null, city: string | null) {
  const street = address?.trim();
  const town = city?.trim();
  if (!street && !town) return null;
  return [street, town, "Israel"].filter(Boolean).join(", ").slice(0, 240);
}

export function placeKey(address: string | null, city: string | null) {
  const query = placeQuery(address, city);
  if (!query) return null;
  return createHash("sha256").update(query).digest("hex").slice(0, 24);
}
