import { hash, verify } from "@node-rs/argon2";

const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  algorithm: 2, // Argon2id
} as const;

const MAX_PASSWORD_LENGTH = 128;

export async function hashPassword(password: string) {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  if (password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }

  return verify(passwordHash, password, OPTIONS);
}
