import { Readable } from "node:stream";

import { assertStorageKey } from "@/lib/storage/key";
import type { StorageService } from "@/lib/storage/types";

const bucketName = () => process.env.SUPABASE_STORAGE_BUCKET?.trim() || "synapse-audio";

export const supabaseStorage: StorageService = {
  async put(key, body, mimeType) {
    assertStorageKey(key);
    await ensurePrivateBucket();
    const response = await fetch(objectUrl(key), {
      method: "POST",
      headers: {
        ...authHeaders(),
        "content-type": mimeType,
        "x-upsert": "false",
      },
      body: new Uint8Array(body),
    });
    if (!response.ok) throw new Error("storage.put_failed");
  },

  async getStream(key) {
    assertStorageKey(key);
    const response = await fetch(objectUrl(key), { headers: authHeaders() });
    if (!response.ok || !response.body) throw new Error("storage.get_failed");
    return Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
  },

  async delete(key) {
    assertStorageKey(key);
    const response = await fetch(objectUrl(key), { method: "DELETE", headers: authHeaders() });
    if (!response.ok && response.status !== 404) throw new Error("storage.delete_failed");
  },
};

function objectUrl(key: string) {
  return `${projectUrl()}/storage/v1/object/${bucketName()}/${key}`;
}

function projectUrl() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  if (!url) throw new Error("storage.unconfigured");
  return url;
}

function serviceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("storage.unconfigured");
  return key;
}

function authHeaders() {
  const key = serviceKey();
  return { authorization: `Bearer ${key}`, apikey: key };
}

async function ensurePrivateBucket() {
  const response = await fetch(`${projectUrl()}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ name: bucketName(), public: false }),
  });
  if (response.ok || response.status === 409) return;
  const existing = await fetch(`${projectUrl()}/storage/v1/bucket/${bucketName()}`, {
    headers: authHeaders(),
  });
  if (!existing.ok) throw new Error("storage.bucket_failed");
}
