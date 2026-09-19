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

  const mime = file.type.trim().toLowerCase().split(";")[0] ?? "";
  const ext = extension(file.name) || extensionFromMime(mime);
  const rule = RULES.find((item) => item.ext === ext);
  if (!rule) {
    // iOS envoie parfois audio/mp4 sans extension exploitable.
    if (mime === "audio/mp4" || mime === "audio/x-m4a" || mime === "audio/m4a") {
      return { ok: true, mimeType: "audio/mp4" };
    }
    return { ok: false, code: "type" };
  }

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

function extensionFromMime(mime: string) {
  if (mime === "audio/mp4" || mime === "audio/x-m4a" || mime === "audio/m4a") return "m4a";
  if (mime === "audio/mpeg" || mime === "audio/mp3") return "mp3";
  if (mime.startsWith("audio/wav") || mime === "audio/wave" || mime === "audio/x-wav") return "wav";
  if (mime === "audio/aac" || mime === "audio/x-aac" || mime === "audio/aacp") return "aac";
  if (mime === "audio/webm") return "webm";
  return "";
}

export function safeFilename(name: string) {
  const base = (name.split(/[/\\]/).pop() ?? "").replace(/[\u0000-\u001f]/g, "").trim();
  return base.slice(0, 180) || null;
}
