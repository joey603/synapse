import "server-only";

const FORBIDDEN_PUBLIC_KEYS = [
  "NEXT_PUBLIC_OPENAI_API_KEY",
  "NEXT_PUBLIC_DATABASE_URL",
  "NEXT_PUBLIC_AUTH_SECRET",
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function assertNoPublicSecrets() {
  for (const key of FORBIDDEN_PUBLIC_KEYS) {
    if (process.env[key]) {
      throw new Error(
        `${key} est interdit : ce secret ne doit pas atteindre le navigateur.`,
      );
    }
  }
}
