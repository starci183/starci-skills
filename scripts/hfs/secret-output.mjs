// secret-output.mjs - list and materialize secret names and private KEY files.
import fs from "node:fs";
import path from "node:path";
import { byCodeUnit } from "../lib/list.mjs";
import { materializedDirectory, writeSecretFile } from "./secret-files.mjs";
import { envelopeOf, validateKey } from "./secret-document.mjs";
import { fileOf, readMap, sealedFiles } from "./secret-store.mjs";
import { SecretError, publicStorage } from "./secret-errors.mjs";

function validateWindowsKeys(map) {
  const names = new Set();
  for (const key of Object.keys(map)) {
    const normalized = key.toUpperCase();
    if (names.has(normalized))
      throw new SecretError(
        "KEY names differing only by case cannot be materialized on Windows",
      );
    if (/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(normalized))
      throw new SecretError(
        "a KEY uses a reserved Windows file name and cannot be materialized",
      );
    names.add(normalized);
  }
}

function exportValues(
  map,
  {
    repoRoot,
    environment,
    env,
    platform,
    stdout,
    fileOutput = stdout,
    reveal = false,
    toFile = true,
  },
) {
  if (toFile && platform === "win32") validateWindowsKeys(map);
  const directory = toFile
    ? publicStorage(() =>
        materializedDirectory(repoRoot, environment, env, platform),
      )
    : null;
  for (const key of Object.keys(map).sort(byCodeUnit)) {
    if (toFile) {
      const file = publicStorage(() =>
        writeSecretFile(directory, key, map[key]),
      );
      fileOutput(`${key}_FILE=${file}\n`);
    }
    if (reveal) stdout(`${key}=${map[key]}\n`);
  }
  return 0;
}

export function listSecrets(directory, stdout) {
  const keys = new Set();
  for (const name of sealedFiles(directory)) {
    for (const item of envelopeOf(
      fs.readFileSync(path.join(directory, name), "utf8"),
    ).keys) {
      validateKey(item);
      keys.add(item);
    }
  }
  for (const item of [...keys].sort(byCodeUnit)) stdout(`${item}\n`);
  return 0;
}

export function materializeSecrets(directory, sops, output) {
  const map = Object.create(null);
  for (const name of sealedFiles(directory)) {
    for (const [item, value] of Object.entries(
      readMap(fileOf(directory, name.slice(0, -4)), sops),
    )) {
      if (Object.hasOwn(map, item))
        throw new SecretError(
          `duplicate KEY ${item} across secret slugs; each materialized KEY needs one owner`,
        );
      map[item] = value;
    }
  }
  return exportValues(map, output);
}

export function getSecret(file, key, sops, opts, output, stderr) {
  let map = readMap(file, sops);
  if (key !== undefined) {
    if (!Object.hasOwn(map, key))
      throw new SecretError(`the secret has no KEY ${key}`);
    map = { [key]: map[key] };
  }
  return exportValues(map, {
    ...output,
    fileOutput: stderr,
    reveal: opts.reveal,
    toFile: opts["to-file"] === true,
  });
}
