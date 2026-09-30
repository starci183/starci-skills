#!/usr/bin/env node
// check-canon-pins.mjs — knowledge/hfs/canon-pins.yaml holds the one shape modules/schemas/canon-pins.schema.yaml
// describes, and every pin that names a `source` equals the version of that package in this runtime.
//
//   CANON_PINS_INVALID   the document breaks the schema (a range, a missing required pin, an unknown key)
//   CANON_PIN_SOURCE     a `source` is missing on disk, or its package name / version differs from the pin
//   CANON_PIN_NO_SOURCE  a `starci` pin names no source, or a non-starci pin names one
//
//   node scripts/checks/check-canon-pins.mjs [--json]
//   node scripts/checks/check-canon-pins.mjs --repo <product repo> [--side be|fe] [--json]
//
// With --repo the same pins judge a product repository: every pinned dependency it declares must be that exact
// version (a registry pin) or the linked copy under .starci/packages must carry it (a @starci pin), and a
// dependency the side owns but the repo does not declare is reported by the repo's own lint, not here.
// Exit 0 is clean; any finding exits 1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { validateAgainstSchema } from './check-op-manifest.mjs';

export const PINS_FILE = 'knowledge/hfs/canon-pins.yaml';
export const SCHEMA_FILE = 'modules/schemas/canon-pins.schema.yaml';
const DEP_KEYS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

export function loadPins(root = skillRoot) {
  return parseYaml(fs.readFileSync(path.join(root, PINS_FILE), 'utf8'));
}

export function checkCanonPins({ root = skillRoot } = {}) {
  const errors = [];
  let doc;
  try {
    doc = loadPins(root);
  } catch (error) {
    return { ok: false, errors: [`CANON_PINS_INVALID ${PINS_FILE} is unreadable: ${error.message}`], pins: 0 };
  }
  const schema = parseYaml(fs.readFileSync(path.join(root, SCHEMA_FILE), 'utf8'));
  for (const message of validateAgainstSchema(doc, schema)) errors.push(`CANON_PINS_INVALID ${message}`);
  for (const [name, pin] of Object.entries(doc?.pins ?? {})) {
    if (!pin || typeof pin !== 'object') continue;
    if (pin.group === 'starci' && !pin.source) errors.push(`CANON_PIN_NO_SOURCE ${name}: a starci pin names the package.json it must equal`);
    if (pin.group !== 'starci' && (pin.source || pin.install)) errors.push(`CANON_PIN_NO_SOURCE ${name}: only a starci pin carries a source or an install`);
    if (!pin.source) continue;
    const file = path.join(root, pin.source);
    if (!fs.existsSync(file)) { errors.push(`CANON_PIN_SOURCE ${name}: ${pin.source} does not exist`); continue; }
    const pkg = readJson(file);
    if (pkg.name !== name) errors.push(`CANON_PIN_SOURCE ${name}: ${pin.source} is named ${pkg.name}`);
    if (pkg.version !== pin.version) errors.push(`CANON_PIN_SOURCE ${name}: pinned ${pin.version} but ${pin.source} is ${pkg.version}`);
  }
  return { ok: errors.length === 0, errors, pins: Object.keys(doc?.pins ?? {}).length };
}

/** Judge one product repository against the pins. `side` limits the pins to that repository kind. */
export function checkRepoPins({ repo, side, root = skillRoot }) {
  const errors = [];
  const doc = loadPins(root);
  const pkg = readJson(path.join(repo, 'package.json'));
  for (const [name, pin] of Object.entries(doc.pins)) {
    if (side && pin.side !== 'both' && pin.side !== side) continue;
    const specs = DEP_KEYS.map((key) => pkg[key]?.[name]).filter((spec) => spec !== undefined);
    if (!specs.length) continue;
    if (pin.group === 'starci' && pin.install !== 'registry') {
      const linked = path.join(repo, '.starci', 'packages', name.replace(/^@starci\//, ''), 'package.json');
      const version = fs.existsSync(linked) ? readJson(linked).version : null;
      if (version !== pin.version) errors.push(`CANON_PIN_DRIFT ${name}: pinned ${pin.version}, linked copy is ${version ?? 'missing (run starci link)'}`);
      continue;
    }
    for (const spec of specs) if (spec !== pin.version) errors.push(`CANON_PIN_DRIFT ${name}: declared ${spec}, pinned ${pin.version}`);
  }
  return { ok: errors.length === 0, errors };
}

export function canonPinsMain(argv = []) {
  const json = argv.includes('--json');
  const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const repo = flag('--repo');
  const result = repo ? checkRepoPins({ repo: path.resolve(repo), side: flag('--side') }) : checkCanonPins();
  if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else if (result.ok) process.stdout.write(repo ? `canon pins: ${repo} matches\n` : `canon pins: ${result.pins} pins valid\n`);
  else for (const message of result.errors) process.stderr.write(`${message}\n`);
  return result.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = canonPinsMain(process.argv.slice(2));
}
