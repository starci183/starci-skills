#!/usr/bin/env node
// check-module-yaml.mjs — every YAML file under modules/ parses with the one
// reader the runtime uses (engine/yaml.mjs).
//   node scripts/checks/check-module-yaml.mjs [--json]
// A supervisor edit left modules/ops/_common.yaml unparseable (an unquoted
// ": " inside a plain scalar) and `npm run check` stayed green, because only
// op manifests were parsed; ops and kernels read that document live. Exit 0 is
// clean; any unparseable file exits 1 and is named.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function moduleYamlFiles(dir = path.join(root, 'modules')) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.ya?ml$/i.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out.sort();
}

export function unparseableYaml(files = moduleYamlFiles()) {
  const bad = [];
  for (const file of files) {
    try { parseYaml(fs.readFileSync(file, 'utf8')); }
    catch (error) { bad.push({ file: path.relative(root, file).split(path.sep).join('/'), error: String(error?.message ?? error).slice(0, 300) }); }
  }
  return bad;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = moduleYamlFiles();
  const bad = unparseableYaml(files);
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: bad.length === 0, files: files.length, bad }, null, 2));
  else if (bad.length) for (const b of bad) console.error(`UNPARSEABLE ${b.file}: ${b.error}`);
  else console.log(`OK: ${files.length} YAML files under modules/ parse.`);
  process.exit(bad.length ? 1 : 0);
}
