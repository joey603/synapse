import { randomUUID } from "node:crypto";

import { getStorage } from "@/lib/storage";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Map([
  ["image/jpeg", "image/jpeg"],
  ["image/jpg", "image/jpeg"],
  ["image/pjpeg", "image/jpeg"],
  ["image/png", "image/png"],
  ["image/webp", "image/webp"],
]);

export type PhotoUpload =
  | { kind: "keep" }
  | { kind: "clear" }
  | { kind: "set"; key: string; mime: string }
  | { kind: "error"; code: "type" | "size" };

export async function resolvePatientPhoto(
  form: FormData,
  currentKey: string | null,
): Promise<PhotoUpload> {
  if (form.get("removePhoto") === "on") {
    return { kind: "clear" };
  }

  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { kind: "keep" };
  }

  const mime = ALLOWED.get(file.type.toLowerCase());
  if (!mime) return { kind: "error", code: "type" };
  if (file.size > MAX_BYTES) return { kind: "error", code: "size" };

  const body = Buffer.from(await file.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_BYTES) {
    return { kind: "error", code: "size" };
  }

  const key = `photos/${randomUUID()}`;
  await getStorage().put(key, body, mime);
  if (currentKey) {
    await getStorage().delete(currentKey).catch(() => undefined);
  }
  return { kind: "set", key, mime };
}

export async function deletePatientPhoto(key: string | null) {
  if (!key) return;
  await getStorage().delete(key).catch(() => undefined);
}

export function patientPhotoUrl(
  patientId: string,
  photoKey: string | null | undefined,
  updatedAt?: Date | null,
) {
  if (!photoKey) return null;
  const stamp = updatedAt ? `?v=${updatedAt.getTime()}` : "";
  return `/api/patients/${patientId}/photo${stamp}`;
}
