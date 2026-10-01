#!/usr/bin/env node
// check-module-yaml.mjs — every YAML file under modules/ and knowledge/ parses with the one
// reader the runtime uses (engine/yaml.mjs). The same break reached knowledge/**/*.yaml (be/test.yaml,
// 2026-09-29) and only the land gate caught it, so knowledge/ is parsed here too.
//   node scripts/checks/check-module-yaml.mjs [--json]
// A supervisor edit left modules/ops/_common.yaml unparseable (an unquoted
// ": " inside a plain scalar) and `npm run check` stayed green, because only
// op manifests were parsed; ops and kernels read that document live. Exit 0 is
// clean; any unparseable file exits 1 and is named.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { isMain } from '../lib/is-main.mjs'; import { walkFiles } from '../lib/walk.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const YAML_ROOTS = Object.freeze(['modules', 'knowledge']);

export function moduleYamlFiles(dirs = YAML_ROOTS.map(name => path.join(root, name))) {
  return [dirs].flat().flatMap(dir => walkFiles(dir, {filter: name => /\.ya?ml$/i.test(name)})).sort();
}

export function unparseableYaml(files = moduleYamlFiles()) {
  const bad = [];
  for (const file of files) {
    try { parseYaml(fs.readFileSync(file, 'utf8')); }
    catch (error) { bad.push({ file: path.relative(root, file).split(path.sep).join('/'), error: String(error?.message ?? error).slice(0, 300) }); }
  }
  return bad;
}

if (isMain(import.meta.url)) {
  const files = moduleYamlFiles();
  const bad = unparseableYaml(files);
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: bad.length === 0, files: files.length, bad }, null, 2));
  else if (bad.length) for (const b of bad) console.error(`UNPARSEABLE ${b.file}: ${b.error}`);
  else console.log(`OK: ${files.length} YAML files under ${YAML_ROOTS.join('/ and ')}/ parse.`);
  process.exit(bad.length ? 1 : 0);
}
