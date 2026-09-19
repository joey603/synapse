import "server-only";

const REDACTED = "[redacted]";

const SENSITIVE_KEY =
  /transcript|rawtext|aidraft|editeddraft|finaltext|finalreport|patientstatus|mainproblem|currentmedication|intervention|careplan|diagnosis|nursenote|suicid|symptom|password|secret|token|authorization|apikey|api_key|openai|audio|dosage|dose|summary|phone|address|firstname|lastname|context|prompt|payload/i;

const SECRET_VALUE = /\bsk-[A-Za-z0-9_-]{8,}\b|\bBearer\s+\S+/i;

function redact(value: unknown, key = ""): unknown {
  if (SENSITIVE_KEY.test(key)) {
    return REDACTED;
  }

  if (typeof value === "string") {
    return SECRET_VALUE.test(value) ? REDACTED : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redact(childValue, childKey),
      ]),
    );
  }

  return value;
}

function write(level: "info" | "error", message: string, meta?: unknown) {
  const payload = {
    level,
    message: SECRET_VALUE.test(message) ? REDACTED : message,
    ...(meta === undefined ? {} : { meta: redact(meta) }),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  console.info(line);
}

export const logger = {
  info(message: string, meta?: unknown) {
    write("info", message, meta);
  },
  error(message: string, meta?: unknown) {
    write("error", message, meta);
  },
};
