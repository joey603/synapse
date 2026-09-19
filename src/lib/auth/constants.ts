export const SESSION_COOKIE = "synapse_session";
export const SESSION_USER_COOKIE = "synapse_user";

/** 30 jours, prolongée à chaque visite (cookie + base). */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const LOCKOUT_AFTER = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
