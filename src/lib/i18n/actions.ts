"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { resolveLocale } from "@/lib/i18n/locale";

export async function setLocale(formData: FormData) {
  const locale = resolveLocale(String(formData.get("locale") ?? ""));
  const store = await cookies();

  store.set("synapse_locale", locale, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  logger.info("locale.changed", { locale });
  revalidatePath("/", "layout");
}
