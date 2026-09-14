import "server-only";

import { localStorage } from "@/lib/storage/local";
import { supabaseStorage } from "@/lib/storage/supabase";
import type { StorageService } from "@/lib/storage/types";

export function getStorage(): StorageService {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "local") return localStorage;
  if (driver === "supabase") return supabaseStorage;
  throw new Error("storage.driver_unsupported");
}
