/**
 * Journal technique uniquement — jamais de contenu clinique / PII / secrets.
 * Accepté : visitId interne, promptVersion, durationMs, status, codes d’erreur.
 */

export type TechLogMeta = {
  visitId?: string;
  promptVersion?: string;
  durationMs?: number;
  status?: string;
  code?: string;
  modelConfigured?: boolean;
};

const FORBIDDEN_META_KEY =
  /transcript|nurse|finalReport|patientStatus|mainProblem|medication|diagnos|suicid|carePlan|intervention|openai|prompt|content|text|name|phone|address|secret|token|apikey|password/i;

function assertSafeMeta(meta?: TechLogMeta) {
  if (!meta) return;
  for (const key of Object.keys(meta)) {
    if (FORBIDDEN_META_KEY.test(key)) {
      throw new Error(`techLog: forbidden meta key "${key}"`);
    }
  }
}

/** Log technique sûr (client + serveur). N’accepte que des métadonnées non cliniques. */
export function techLog(message: string, meta?: TechLogMeta) {
  assertSafeMeta(meta);
  if (meta && Object.keys(meta).length > 0) {
    console.info(`[Synapse] ${message}`, meta);
    return;
  }
  console.info(`[Synapse] ${message}`);
}
