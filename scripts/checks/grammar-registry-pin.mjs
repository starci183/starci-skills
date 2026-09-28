#!/usr/bin/env node
// grammar-registry-pin.mjs — a product manifest names @starci/grammar by a
// registry semver range, never a local path.
//   node scripts/checks/grammar-registry-pin.mjs --repo <frontend repo> [--json]
// The owner ruled on 2026-09-23 that consumers take the grammar from npm: a
// `file:` link left starci-academy-fe on a hand-built dist, while nivo-fe and
// miamia-fe pinned 0.4.x from the registry and never saw 0.5.0. Every
// package.json under the repo (node_modules excluded) is read.
import path from 'node:path';
import { readJsonFile } from '../lib/json.mjs';
import { walkFiles } from './common.mjs';

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

if (process.argv[1]?.endsWith('grammar-registry-pin.mjs')) {
  const argv = process.argv.slice(2);
  const repo = argv[argv.indexOf('--repo') + 1];
  if (!repo || argv.indexOf('--repo') < 0) { console.error('use: grammar-registry-pin.mjs --repo <path> [--json]'); process.exit(2); }
  const pins = grammarPinsIn(repo);
  const bad = pins.filter((p) => !p.ok);
  if (argv.includes('--json')) console.log(JSON.stringify({ ok: bad.length === 0, pins }, null, 2));
  else for (const p of pins) console.log(`${p.ok ? 'ok ' : 'BAD'} ${p.file} ${p.section} ${p.spec}${p.reason ? ` — ${p.reason}` : ''}`);
  process.exit(bad.length ? 1 : 0);
}
