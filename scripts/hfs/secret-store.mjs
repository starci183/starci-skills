// secret-store.mjs - sealed secret paths and atomic named-value updates.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { claimFile } from "../api/fs/claim-file.mjs";
import { isSopsEnvelope } from "../lib/sops-envelope.mjs";
import { byCodeUnit } from "../lib/list.mjs";
import {
  envelopeOf,
  plaintextOf,
  validateKey,
  validateMap,
} from "./secret-document.mjs";
import { defaultSops } from "./secret-sops.mjs";
import { SecretError } from "./secret-errors.mjs";

const SLUG = /^[a-z0-9][a-z0-9-]*$/u;

/** The directory of the sealed secrets of the app at `repoRoot` for `env`; the one env that has secrets when none is named. */
export function secretsDirectory(repoRoot, env) {
  const stacks = path.join(repoRoot, ".starcistacks");
  if (env) {
    if (!/^[a-z0-9][a-z0-9-]*$/u.test(env))
      throw new SecretError(`--env ${env} is not an environment name`);
    return path.join(stacks, env, "secrets");
  }
  if (!fs.existsSync(stacks))
    throw new SecretError(
      "this app has no .starcistacks; run starci app secret at the app root, or pass --cwd",
    );
  const withSecrets = fs
    .readdirSync(stacks, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(path.join(stacks, entry.name, "secrets")),
    )
    .map((entry) => entry.name);
  if (withSecrets.length === 1)
    return path.join(stacks, withSecrets[0], "secrets");
  throw new SecretError(
    withSecrets.length === 0
      ? "no environment of .starcistacks has a secrets folder; pass --env to create the first secret"
      : `more than one environment has secrets (${withSecrets.join(", ")}); pass --env`,
  );
}

export const fileOf = (directory, slug) => {
  if (!SLUG.test(slug ?? ""))
    throw new SecretError(
      `${slug === undefined ? "a secret name" : slug} is not a secret slug: lowercase letters, digits and dashes`,
    );
  return path.join(directory, `${slug}.enc`);
};

/** Seal `key = value` into the secret `slug`: an existing document keeps its other keys and its recipients. */
export function writeSecret({ file, values, age, sops }) {
  for (const key of Object.keys(values)) validateKey(key);
  const held = claimFile(path.resolve(file));
  if (!held.ok)
    throw new SecretError(
      "the sealed secret is being updated; retry after that write settles",
    );
  try {
    const format = "dotenv";
    let map = Object.create(null);
    let recipients = age;
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, "utf8");
      const envelope = envelopeOf(text);
      map = sops.decrypt(file, envelope.format);
      if (!age.length) recipients = envelope.recipients;
    }
    validateMap(map);
    map = { ...map, ...values };
    const sealed = sops.seal({
      inputType: format,
      plaintext: plaintextOf(format, map),
      recipients,
      filenameOverride: file,
    });
    let parsed;
    try {
      parsed = envelopeOf(sealed);
    } catch {
      throw new SecretError("sops returned an invalid sealed document");
    }
    if (
      !isSopsEnvelope(sealed) ||
      parsed.keys.length !== Object.keys(map).length ||
      !parsed.keys.every((key) => Object.hasOwn(map, key))
    )
      throw new SecretError("sops returned an invalid sealed document");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = path.join(
      path.dirname(file),
      `.${path.basename(file)}-${randomUUID()}.tmp`,
    );
    try {
      fs.writeFileSync(temporary, sealed, {
        flag: "wx",
        mode: 0o600,
        flush: true,
      });
      fs.renameSync(temporary, file);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  } finally {
    held.release();
  }
}

/** Update named keys through the same canonical sealed-secret owner used by the CLI. */
export function setSecretValues(
  repoRoot,
  { slug, values, env = null },
  { sops = null, age = [], processEnv = process.env } = {},
) {
  const directory = secretsDirectory(repoRoot, env);
  const file = fileOf(directory, slug);
  if (
    !values ||
    typeof values !== "object" ||
    Array.isArray(values) ||
    !Object.keys(values).length
  )
    throw new SecretError("secret update requires named values");
  for (const value of Object.values(values))
    if (typeof value !== "string" || value === "")
      throw new SecretError("secret values must be nonempty strings");
  writeSecret({
    file,
    values,
    age,
    sops: sops ?? defaultSops(processEnv, repoRoot),
  });
  return { file, via: "sealed-secret" };
}

export function sealedFiles(directory) {
  return fs.existsSync(directory)
    ? fs
        .readdirSync(directory)
        .filter((name) => name.endsWith(".enc"))
        .sort(byCodeUnit)
    : [];
}

export function readMap(file, sops) {
  if (!fs.existsSync(file))
    throw new SecretError(
      "the requested secret is not sealed in this environment",
    );
  const map = sops.decrypt(
    file,
    envelopeOf(fs.readFileSync(file, "utf8")).format,
  );
  validateMap(map);
  return map;
}
