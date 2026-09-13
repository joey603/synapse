export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const RULES = [
  { ext: "m4a", mimes: ["audio/mp4", "audio/x-m4a", "audio/m4a"] },
  { ext: "mp3", mimes: ["audio/mpeg", "audio/mp3"] },
  { ext: "wav", mimes: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"] },
  { ext: "aac", mimes: ["audio/aac", "audio/x-aac", "audio/aacp"] },
  { ext: "webm", mimes: ["audio/webm"] },
] as const;

export type AudioCheck =
  | { ok: true; mimeType: string }
  | { ok: false; code: "empty" | "size" | "type" };

export function inspectAudioFile(file: { name: string; type: string; size: number }): AudioCheck {
  if (file.size <= 0) return { ok: false, code: "empty" };
  if (file.size > MAX_AUDIO_BYTES) return { ok: false, code: "size" };

  const ext = extension(file.name);
  const rule = RULES.find((item) => item.ext === ext);
  if (!rule) return { ok: false, code: "type" };

  const mime = file.type.trim().toLowerCase().split(";")[0] ?? "";
  const allowed = rule.mimes as readonly string[];
  const loose = mime === "" || mime === "application/octet-stream";
  if (!loose && !allowed.includes(mime)) {
    return { ok: false, code: "type" };
  }

  return { ok: true, mimeType: loose ? rule.mimes[0] : mime };
}

function extension(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function safeFilename(name: string) {
  const base = (name.split(/[/\\]/).pop() ?? "").replace(/[\u0000-\u001f]/g, "").trim();
  return base.slice(0, 180) || null;
}
