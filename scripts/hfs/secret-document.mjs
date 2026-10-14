// secret-document.mjs - envelope inspection, plaintext serialization and named-value validation.
import { SecretError } from "./secret-errors.mjs";

const KEY = /^[A-Za-z_]\w*$/u;
const WHITESPACE = String.raw`\s`;
const REQUIRED_INDENT = `${WHITESPACE}+`;
const OPTIONAL_DASH = "-?";
const OPTIONAL_SPACING = `${WHITESPACE}*`;
const RECIPIENT_NAME = "recipient:";
const RECIPIENT_VALUE = String.raw`(\S+)`;
const RECIPIENT_LINE = new RegExp(
  `^${REQUIRED_INDENT}${OPTIONAL_DASH}${OPTIONAL_SPACING}${RECIPIENT_NAME}${OPTIONAL_SPACING}${RECIPIENT_VALUE}`,
  "gmu",
);

/** The envelope format of a sealed secret, read from its text: json, yaml or dotenv. */
export function formatOf(text) {
  const body = String(text).trimStart();
  if (body.startsWith("{")) return "json";
  if (/^sops:\s*$/mu.test(text)) return "yaml";
  return "dotenv";
}

/** The key names a sealed document holds and the age recipients it is sealed to, read without decrypting anything. */
export function envelopeOf(text) {
  const format = formatOf(text);
  if (format === "json") {
    const doc = JSON.parse(text);
    return {
      format,
      keys: Object.keys(doc).filter((name) => name !== "sops"),
      recipients: (doc.sops?.age ?? [])
        .map((entry) => entry.recipient)
        .filter(Boolean),
    };
  }
  if (format === "yaml") {
    const keys = [...text.matchAll(/^([A-Za-z_]\w*):/gmu)]
      .map((match) => match[1])
      .filter((name) => name !== "sops");
    return {
      format,
      keys,
      recipients: [...text.matchAll(RECIPIENT_LINE)].map((match) => match[1]),
    };
  }
  const keys = [...text.matchAll(/^([A-Za-z_]\w*)=/gmu)]
    .map((match) => match[1])
    .filter((name) => !name.startsWith("sops_"));
  return {
    format,
    keys,
    recipients: [
      ...text.matchAll(/^sops_age__list_\d+__map_recipient=(\S+)/gmu),
    ].map((match) => match[1]),
  };
}

/** SOPS dotenv escapes LF as backslash-n; literal backslash-n has no distinct representation. */
export function plaintextOf(format, map) {
  if (format === "json") return `${JSON.stringify(map)}\n`;
  if (format === "yaml")
    return (
      Object.entries(map)
        .map(([name, value]) => name + ": " + JSON.stringify(value))
        .join("\n") + "\n"
    );
  for (const value of Object.values(map))
    if (/\r|\\n/u.test(value))
      throw new SecretError(
        "dotenv cannot preserve a carriage return or literal backslash-n; use an LF line break instead",
      );
  return (
    Object.entries(map)
      .map(
        ([name, value]) => name + "=" + value.replaceAll("\n", String.raw`\n`),
      )
      .join("\n") + "\n"
  );
}

export function validateKey(key) {
  if (!KEY.test(key ?? "") || key.startsWith("sops_"))
    throw new SecretError(
      "KEY must be an environment variable name outside the reserved sops_ namespace",
    );
}

export function validateMap(map) {
  if (!map || typeof map !== "object" || Array.isArray(map))
    throw new SecretError("sops returned an invalid secret map");
  for (const [key, value] of Object.entries(map)) {
    validateKey(key);
    if (typeof value !== "string")
      throw new SecretError("secret values must be strings");
  }
}
