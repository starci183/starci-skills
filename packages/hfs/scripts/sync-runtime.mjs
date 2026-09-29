#!/usr/bin/env node
// sync-runtime.mjs - refreshes packages/hfs/runtime, the self-contained copy of the runtime files `hfs` reads, so the
// package works in a product repository that has no runtime checkout. The copy mirrors the runtime layout
// (engine/, scripts/lib/, knowledge/hfs/, modules/kernel/) byte for byte, so the imports need no rewriting; the
// failure-code catalog is the slice holding only the codes `hfs` can emit.
//   node packages/hfs/scripts/sync-runtime.mjs [--check]     --check exits 1 when the copy differs (tests/hfs-cli.spec.mjs runs it)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECK_CODES } from '../../../scripts/lib/hfs-check.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const bundleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'runtime');
export const COPIED = Object.freeze([
  'engine/runtime-root.mjs',
  'engine/yaml.mjs',
  'scripts/lib/glob.mjs',
  'scripts/lib/path-key.mjs',
  'scripts/lib/hfs-slots.mjs',
  'scripts/lib/hfs-check.mjs',
  'knowledge/hfs/slots.yaml',
  'knowledge/hfs/canon-pins.yaml',
]);
export const CATALOG = 'modules/kernel/failure-codes.yaml';

/** The catalog entries for `codes`, in the catalog's own text, keyed by top-level line. */
export function catalogSlice(text, codes) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n(?=[A-Z][A-Z0-9_]+:\n)/);
  const byCode = new Map(blocks.map((b) => [b.slice(0, b.indexOf(':')), b.replace(/\s+$/, '')]));
  return `${[...codes].sort().map((code) => {
    if (!byCode.has(code)) throw new Error(`${CATALOG} has no entry for ${code}`);
    return byCode.get(code);
  }).join('\n\n')}\n`;
}

/** {relative path: expected text} of the whole copy. */
export function expectedRuntime() {
  const out = new Map();
  for (const file of COPIED) out.set(file, fs.readFileSync(path.join(runtimeRoot, file), 'utf8'));
  out.set(CATALOG, catalogSlice(fs.readFileSync(path.join(runtimeRoot, CATALOG), 'utf8'), CHECK_CODES));
  return out;
}

const listed = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listed(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')]));

/** The differences between the copy on disk and what it should be: missing, stale, extra. */
export function driftOfRuntime() {
  const expected = expectedRuntime();
  const problems = [];
  for (const [file, text] of expected) {
    const target = path.join(bundleRoot, file);
    if (!fs.existsSync(target)) problems.push(`missing ${file}`);
    else if (fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== text.replace(/\r\n/g, '\n')) problems.push(`stale ${file}`);
  }
  if (fs.existsSync(bundleRoot)) for (const file of listed(bundleRoot)) if (!expected.has(file)) problems.push(`extra ${file}`);
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const problems = driftOfRuntime();
    for (const p of problems) process.stderr.write(`hfs runtime drift: ${p}\n`);
    process.exitCode = problems.length ? 1 : 0;
  } else {
    fs.rmSync(bundleRoot, { recursive: true, force: true });
    for (const [file, text] of expectedRuntime()) {
      const target = path.join(bundleRoot, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text);
    }
    process.stdout.write(`hfs runtime synced: ${expectedRuntime().size} files\n`);
  }
}
