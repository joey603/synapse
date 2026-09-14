import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertStorageKey } from "@/lib/storage/key";
import type { StorageService } from "@/lib/storage/types";

const ROOT = path.resolve(process.cwd(), "storage");

export const localStorage: StorageService = {
  async put(key, body) {
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body, { flag: "wx" });
  },
  async getStream(key) {
    return createReadStream(resolveKey(key));
  },
  async delete(key) {
    await unlink(resolveKey(key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  },
};

function resolveKey(key: string) {
  assertStorageKey(key);
  const full = path.resolve(ROOT, key);
  if (full !== path.join(ROOT, key)) {
    throw new Error("storage.key_invalid");
  }
  return full;
}
