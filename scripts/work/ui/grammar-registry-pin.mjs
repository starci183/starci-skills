#!/usr/bin/env node
// grammar-registry-pin.mjs — a product manifest names @starci/grammar by a
// registry spec, never a local path. This check does not validate semver syntax.
//   starci work grammar-registry-pin --repo <frontend repo> [--json]
// The owner ruled on 2026-09-23 that consumers take the grammar from npm: a
// `file:` link left one consumer on a hand-built dist, while others
// pinned 0.4.x from the registry and never saw 0.5.0. Every
// package.json under the repo (node_modules excluded) is read.
import path from 'node:path';
import { readJsonFile } from '../../lib/json.mjs';
import { isMain } from '../../lib/is-main.mjs'; import { walkFiles } from '../../lib/walk.mjs';

const PACKAGE = '@starci/grammar';
const LOCAL = /^(?:file:|link:|portal:|workspace:|\.{0,2}\/|[A-Za-z]:[\\/])/;
const SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

/** Every @starci/grammar spec in one manifest object: [{section, spec, ok, reason}]. */
export function grammarPinsOf(manifest) {
  return SECTIONS.flatMap((section) => {
    const spec = manifest?.[section]?.[PACKAGE];
    if (spec == null) return [];
    const local = LOCAL.test(String(spec));
    return [{ section, spec: String(spec), ok: !local, ...(local ? { reason: `${PACKAGE} is linked from a local path (${spec}); use a registry semver range such as ^0.5.0` } : {}) }];
  });
}

/** All manifests under `repo` that name the grammar: [{file, section, spec, ok, reason}]. */
export function grammarPinsIn(repo) {
  const out = [];
  for (const full of walkFiles(path.resolve(repo), {maxDepth: 4, ignoreReadErrors: true,
    exclude: name => name === 'node_modules' || name.startsWith('.'), filter: name => name === 'package.json'})) {
    const manifest = readJsonFile(full);
    for (const pin of grammarPinsOf(manifest)) out.push({ file: path.relative(repo, full).split(path.sep).join('/'), ...pin });
  }
  return out;
}

const USAGE = 'use: starci work grammar-registry-pin --repo <path> [--json]';

function parseArgs(argv) {
  let repo, json = false;
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === '--repo' && repo === undefined) {
      repo = argv[++index];
      if (!repo || repo.startsWith('--')) throw new Error(USAGE);
    } else if (value === '--json' && !json) json = true;
    else throw new Error(`unexpected argument ${value}; ${USAGE}`);
  }
  if (!repo) throw new Error(USAGE);
  return { repo, json };
}

if (isMain(import.meta.url)) {
  let repo, json;
  try { ({ repo, json } = parseArgs(process.argv.slice(2))); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
  if (repo) {
    const pins = grammarPinsIn(repo);
    const bad = pins.filter((p) => !p.ok);
    if (json) console.log(JSON.stringify({ ok: bad.length === 0, pins }, null, 2));
    else for (const p of pins) console.log(`${p.ok ? 'ok ' : 'BAD'} ${p.file} ${p.section} ${p.spec}${p.reason ? ` — ${p.reason}` : ''}`);
    process.exitCode = bad.length ? 1 : 0;
  }
}
