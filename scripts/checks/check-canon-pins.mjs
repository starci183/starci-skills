#!/usr/bin/env node
// check-canon-pins.mjs — knowledge/hfs/canon-pins.yaml holds the one shape modules/schemas/canon-pins.schema.yaml
// describes, and every pin that names a `source` equals the version of that package in this runtime.
//
//   CANON_PINS_INVALID   the document breaks the schema (a range, a missing required pin, an unknown key)
//   CANON_PIN_SOURCE     a `source` is missing on disk, or its package name / version differs from the pin
//   CANON_PIN_NO_SOURCE  a `starci` pin names no source, or a non-starci pin names one
//
// and every profile of modules/models/code-patterns.yaml is bound to the canon this runtime publishes:
//
//   CANON_BINDING_VERSION  canon.version differs from the canon's package.json version or from its pin here
//   CANON_BINDING_DIGEST   the digest of the canon's PUBLISHED file set (the npm pack list of the pin's source directory,
//                          scripts/gates/canon-digest.mjs) differs from canon.contentDigest.value or .files
//   CANON_BINDING_INVALID  a profile names no pinned canon, or its digest policy or file set is refused (the typed
//                          CANON_DIGEST_* / CANON_PACKAGE_* / CANON_PACK_UNAVAILABLE code is quoted)
//
// So a canon change without a version bump and a rebinding of the profile fails `npm run check`.
//
//   node scripts/checks/check-canon-pins.mjs [--json]
//   node scripts/checks/check-canon-pins.mjs --repo <app root> [--json]
//
// With --repo the same pins judge the one package.json at an app root (it carries the dependencies of both sides): every
// pinned dependency it declares must be that exact version (every pin, @starci packages included, is installed from the
// npm registry); a dependency the app needs but does not declare is reported by the app's own lint, not here.
// Exit 0 is clean; any finding exits 1.
import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { validateAgainstSchema } from '../lib/json-schema.mjs';
import { canonContentDigest, packedFiles } from '../gates/canon-digest.mjs';
import { PINS_FILE, PROFILES_FILE, SCHEMA_FILE, loadPins } from '../gates/canon-pins.mjs';

const BINDING = Object.freeze({ version: 'CANON_BINDING_VERSION', digest: 'CANON_BINDING_DIGEST', invalid: 'CANON_BINDING_INVALID' });
const DEP_KEYS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

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
    if (pin.group === 'starci' && pin.install !== 'registry') errors.push(`CANON_PIN_NO_SOURCE ${name}: a starci pin is installed from the npm registry (install: registry)`);
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

/** Every code-pattern profile's canon binding against the canon source this runtime publishes; `pack` lists a package's published files. */
export function checkCanonBindings({ root = skillRoot, pack = packedFiles } = {}) {
  const errors = [];
  const pins = loadPins(root).pins ?? {};
  const profiles = parseYaml(fs.readFileSync(path.join(root, PROFILES_FILE), 'utf8'))?.profiles ?? {};
  for (const [profile, value] of Object.entries(profiles)) {
    const canon = value?.canon, pin = pins[canon?.package];
    if (!canon || !pin?.source) { errors.push(`${BINDING.invalid} ${profile}: canon.package ${canon?.package} is not a pinned package with a source`); continue; }
    const manifest = readJson(path.join(root, pin.source)), directory = path.dirname(path.join(root, pin.source));
    if (canon.version !== manifest.version || canon.version !== pin.version) errors.push(`${BINDING.version} ${profile}: canon.version ${canon.version}, ${pin.source} is ${manifest.version}, pinned ${pin.version}`);
    let digest;
    try { digest = canonContentDigest(directory, canon.contentDigest, pack(directory)); } catch (error) { errors.push(`${BINDING.invalid} ${profile}: ${error.code ?? 'ERROR'} ${error.message}`); continue; }
    if (digest.value !== canon.contentDigest.value || digest.files !== canon.contentDigest.files) errors.push(`${BINDING.digest} ${profile}: ${canon.package} publishes ${digest.files} files digesting ${digest.value}, bound ${canon.contentDigest.files} files ${canon.contentDigest.value}; every published file is in the digest, the copies bundled into the canon's runtime/ folder (canon-pins, failure codes, slots) included, so this change needs a version bump of ${canon.package} and its pin, a republish, and a rebinding of profiles.${profile}.canon (version and contentDigest) in ${PROFILES_FILE}`);
  }
  return { ok: errors.length === 0, errors, profiles: Object.keys(profiles).length };
}

/** Judge the root package.json of one app against every pin. */
export function checkRepoPins({ repo, root = skillRoot }) {
  const errors = [];
  const doc = loadPins(root);
  const pkg = readJson(path.join(repo, 'package.json'));
  for (const [name, pin] of Object.entries(doc.pins)) {
    const specs = DEP_KEYS.map((key) => pkg[key]?.[name]).filter((spec) => spec !== undefined);
    if (!specs.length) continue;
    for (const spec of specs) if (spec !== pin.version) errors.push(`CANON_PIN_DRIFT ${name}: declared ${spec}, pinned ${pin.version}`);
  }
  return { ok: errors.length === 0, errors };
}

const merged = (pins, bindings) => ({ ...pins, ok: pins.ok && bindings.ok, errors: [...pins.errors, ...bindings.errors], profiles: bindings.profiles });

function canonPinsMain(argv = []) {
  const json = argv.includes('--json');
  const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const repo = flag('--repo');
  const result = repo ? checkRepoPins({ repo: path.resolve(repo) }) : merged(checkCanonPins(), checkCanonBindings());
  if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else if (result.ok) process.stdout.write(repo ? `canon pins: ${repo} matches\n` : `canon pins: ${result.pins} pins valid, ${result.profiles} profiles bound to their published canon\n`);
  else for (const message of result.errors) process.stderr.write(`${message}\n`);
  return result.ok ? 0 : 1;
}

if (isMain(import.meta.url)) {
  process.exitCode = canonPinsMain(process.argv.slice(2));
}
