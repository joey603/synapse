import { createHash } from "node:crypto";

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const GEO_VERSION = "2";
const REJECT = new Set(["country", "state", "continent", "county"]);

function normalizePlace(address: string | null, city: string | null) {
  let street = address?.trim() ?? "";
  const town = city?.trim() ?? "";
  if (street && town) {
    const escaped = town.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    street = street
      .replace(new RegExp(`[,\\s]*${escaped}\\s*$`, "u"), "")
      .replace(new RegExp(`^${escaped}[,\\s]+`, "u"), "")
      .trim();
  }
  street = street.replace(/^רחוב\s+/u, "").replace(/^רח['׳]\s+/u, "").trim();
  return { street: street || null, city: town || null };
}

function placeQuery(address: string | null, city: string | null) {
  const { street, city: town } = normalizePlace(address, city);
  if (!street && !town) return null;
  return [street, town, "Israel"].filter(Boolean).join(", ").slice(0, 240);
}

function placeKey(address: string | null, city: string | null) {
  const query = placeQuery(address, city);
  if (!query) return null;
  return createHash("sha256").update(`${GEO_VERSION}|${query}`).digest("hex").slice(0, 24);
}

async function nominatimSearch(params: { q?: string | null; street?: string; city?: string }) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "il");
  if (params.q) url.searchParams.set("q", params.q);
  if (params.street) url.searchParams.set("street", params.street);
  if (params.city) url.searchParams.set("city", params.city);

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "accept-language": "he,fr,en",
      "user-agent": "Synapse/1.0 (psychiatric home-care documentation)",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("geocode_http");

  const rows = (await response.json()) as Array<{ lat?: string; lon?: string; addresstype?: string; type?: string }>;
  const hit = rows[0];
  if (!hit) return null;
  const kind = hit.addresstype ?? hit.type ?? "";
  if (REJECT.has(kind)) return null;
  const latitude = Number(hit.lat);
  const longitude = Number(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 29 || latitude > 34 || longitude < 34 || longitude > 36.5) return null;
  return { latitude, longitude };
}

async function geocodePlace(address: string | null, city: string | null) {
  const { street, city: town } = normalizePlace(address, city);
  if (!street && !town) return null;

  if (street && town) {
    const structured = await nominatimSearch({ street, city: town });
    if (structured) return structured;
    await sleep(1100);
  }

  const free = await nominatimSearch({ q: placeQuery(address, city) });
  if (free) return free;

  if (street && town) {
    const withoutNumber = street.replace(/\b\d+[A-Za-zא-ת]?\b/u, "").replace(/\s+/g, " ").trim();
    if (withoutNumber && withoutNumber !== street) {
      await sleep(1100);
      const road = await nominatimSearch({ street: withoutNumber, city: town });
      if (road) return road;
      await sleep(1100);
      const roadFree = await nominatimSearch({ q: `${withoutNumber}, ${town}, Israel` });
      if (roadFree) return roadFree;
    }
  }

  if (town) {
    await sleep(1100);
    return nominatimSearch({ q: `${town}, Israel` });
  }
  return null;
}

async function main() {
  const patients = await db.patient.findMany({
    where: { status: "ACTIVE", OR: [{ address: { not: null } }, { city: { not: null } }] },
    select: { id: true, firstName: true, lastName: true, address: true, city: true, geoKey: true, latitude: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  let ok = 0;
  let fail = 0;
  let skipped = 0;

  for (const [index, patient] of patients.entries()) {
    const key = placeKey(patient.address, patient.city);
    if (!key) {
      skipped += 1;
      continue;
    }
    if (patient.geoKey === key && patient.latitude != null) {
      ok += 1;
      console.log(`SKIP ${patient.firstName} ${patient.lastName}`.trim());
      continue;
    }
    if (index > 0) await sleep(1200);
    const point = await geocodePlace(patient.address, patient.city);
    await db.patient.update({
      where: { id: patient.id },
      data: point
        ? { latitude: point.latitude, longitude: point.longitude, geoKey: key }
        : { latitude: null, longitude: null, geoKey: key },
    });
    if (point) {
      ok += 1;
      console.log(`OK  ${patient.firstName} ${patient.lastName}`.trim(), point.latitude, point.longitude);
    } else {
      fail += 1;
      console.log(`FAIL ${patient.firstName} ${patient.lastName}`.trim(), patient.address, patient.city);
    }
  }

  console.log(JSON.stringify({ total: patients.length, ok, fail, skipped }));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
