// env-value-shape.mjs - R249 HFS_ENV_VALUE_SHAPE (OPS K6, nivo D2-03: `OPENCLAW_MANAGE_AGENTS=1` for an `env.bool`
// read): a stored environment value parses as the type its `EnvSource` reader declares. The reader shapes come from
// the same static TypeScript walk as the env-key parity (collectEnvReads).
//   - the finder judges the concrete values of `*.env.example` files: a value that is not a placeholder must parse;
//   - `starci app secret verify <env>` (verifySecrets) decrypts every member of the environment in memory through the
//     sops seam and checks each stored value against its reader's shape; output names the environment, the member,
//     the key and the violated shape - never a value.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTypescript } from '../../lib/package-at.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
import { envelopeOf } from '../secret-document.mjs';
import { sealedFiles } from '../secret-store.mjs';
import { SecretError } from '../secret-errors.mjs';
import { collectEnvReads, envExampleEntries, isEnvSourcePath } from './env-parity.mjs';
import { found, readText } from './read.mjs';

export const ENV_VALUE_SHAPE = 'ENV_VALUE_SHAPE';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE_SUFFIX = /_FILE$/u;
const ENV_EXAMPLE = /\.env\.example$/u;
const SKIP_DIRECTORY = new Set(['node_modules', 'dist', 'coverage', '.git']);

const SHAPES = Object.freeze({
  int: { text: 'an integer', ok: (value) => value.trim() !== '' && Number.isInteger(Number(value)) },
  bool: { text: 'true or false', ok: (value) => value === 'true' || value === 'false' },
  url: { text: 'an absolute URL', ok: (value) => URL.canParse(value) },
  duration: { text: 'a duration (250, 250ms, 30s, 5m or 2h)', ok: (value) => /^\d+(?:ms|s|m|h)?$/u.test(value) },
  string: { text: 'a nonempty value', ok: (value) => value.length > 0 },
});

/** What a shape violation is called in output; the enum shape names its allowed values. */
export const shapeText = (shape) => (shape.kind === 'enum' ? `one of ${shape.allowed.join(', ')}` : SHAPES[shape.kind].text);

/** Whether `value` parses as `shape` declares. */
export const shapeOk = (shape, value) => (shape.kind === 'enum' ? shape.allowed.includes(value) : SHAPES[shape.kind]?.ok(value) ?? true);

/** An example line holds a documented stand-in, not a value to parse: empty, an `<...>` name or a `${...}` reference. */
const isPlaceholder = (value) => value === '' || value.includes('${') || (value.startsWith('<') && value.endsWith('>'));

/** The repository-relative env source files on disk: the be side of an app, else the src tree of a back-end repository. */
export function listEnvSourceFiles(repoRoot) {
  const out = [];
  const walk = (dir, rel) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORY.has(entry.name)) walk(path.join(dir, entry.name), `${rel}${entry.name}/`);
      } else if (isEnvSourcePath(rel + entry.name)) out.push(rel + entry.name);
    }
  };
  const roots = ['be', 'src'].map((name) => path.join(repoRoot, name)).filter((dir) => { try { return fs.statSync(dir).isDirectory(); } catch { return false; } });
  for (const root of roots) walk(root, `${path.basename(root)}/`);
  return out.sort(byCodeUnit);
}

/** The ENV_VALUE_SHAPE violations of one decrypted map against the walked reader shapes; keys and shapes only. */
export function shapeViolations(reads, map) {
  const violations = [];
  for (const [key, value] of Object.entries(map)) {
    if (FILE_SUFFIX.test(key)) continue;
    const shape = reads.get(key)?.shape;
    if (shape && !shapeOk(shape, value)) violations.push({ key, expected: shapeText(shape) });
  }
  return violations;
}

/** The findings of R249 over the `*.env.example` files of an app judged at its root scope (both editions). */
export function envValueShapeFindings({ repoRoot, all = [], isRoot }) {
  if (!isRoot) return [];
  const examples = all.filter((file) => ENV_EXAMPLE.test(file));
  if (!examples.length) return [];
  const reads = collectEnvReads(repoRoot, all);
  if (reads === null) return [];
  const findings = [];
  for (const file of examples) {
    const text = readText(repoRoot, file);
    if (text === null) continue;
    for (const { key, value } of envExampleEntries(text)) {
      if (isPlaceholder(value)) continue;
      const shape = reads.get(key)?.shape;
      if (shape && !shapeOk(shape, value)) {
        findings.push(found(ENV_VALUE_SHAPE, file, `${file} gives ${key} a value that is not ${shapeText(shape)}; an env example must parse as the EnvSource reader declares`));
      }
    }
  }
  return findings;
}

/**
 * `starci app secret verify <env>`: decrypt every member of `directory` in memory through the `sops` seam and check
 * each value against the shape its EnvSource reader declares. Output names the environment, the member, the key and
 * the violated shape, never a value. Returns the CLI exit code: 0 verified, 2 violations.
 */
export function verifySecrets({ repoRoot, directory, environment, sops, stdout, typescript }) {
  const ts = typescript ?? loadTypescript(repoRoot, HERE);
  if (!ts) throw new SecretError('verify needs the app\'s TypeScript to read <app>.env.ts; install the app\'s dependencies');
  const reads = collectEnvReads(repoRoot, listEnvSourceFiles(repoRoot), ts);
  const violations = [];
  let keys = 0;
  for (const name of sealedFiles(directory)) {
    const file = path.join(directory, name);
    const map = sops.decrypt(file, envelopeOf(fs.readFileSync(file, 'utf8')).format);
    keys += Object.keys(map).length;
    for (const violation of shapeViolations(reads, map)) violations.push({ member: name, ...violation });
  }
  for (const violation of violations) stdout(`ENV_VALUE_SHAPE ${environment}/${violation.member}: ${violation.key} is not ${violation.expected}\n`);
  if (!violations.length) stdout(`verified ${environment}: ${keys} key${keys === 1 ? '' : 's'} sealed\n`);
  return violations.length ? 2 : 0;
}
