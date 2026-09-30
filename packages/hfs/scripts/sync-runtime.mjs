#!/usr/bin/env node
// sync-runtime.mjs - refreshes the self-contained copies of the runtime files the published packages read, so each package
// works in a product repository that has no runtime checkout. Every copy mirrors the runtime layout (engine/,
// scripts/lib/, knowledge/hfs/, modules/kernel/) byte for byte, so the imports need no rewriting.
//   packages/hfs/runtime         what `hfs` reads, plus the failure-code catalog slice holding only the codes it can emit
//   packages/eslint/be/runtime   what @starci/eslint-canon-be reads through lib/hfs.mjs (loadHfs: slots and hfs.json)
//   node packages/hfs/scripts/sync-runtime.mjs [--check]     --check exits 1 when a copy differs (npm run check runs it)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHECK_CODES } from '../../../scripts/lib/hfs-check.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** The runtime files the slot resolver needs; both bundles carry them. */
const SLOT_FILES = [
  'engine/runtime-root.mjs',
  'engine/yaml.mjs',
  'scripts/lib/glob.mjs',
  'scripts/lib/path-key.mjs',
  'scripts/lib/hfs-slots.mjs',
  'knowledge/hfs/slots.yaml',
];
export const CATALOG = 'modules/kernel/failure-codes.yaml';
/** bundle directory (runtime-relative) -> the files it copies and whether it carries the failure-code slice. */
export const BUNDLES = Object.freeze({
  'packages/hfs/runtime': Object.freeze({ files: Object.freeze([...SLOT_FILES, 'scripts/lib/hfs-check.mjs', 'scripts/lib/git.mjs', 'scripts/lib/fs-kind.mjs', 'knowledge/hfs/canon-pins.yaml']), catalog: true }),
  'packages/eslint/be/runtime': Object.freeze({ files: Object.freeze([...SLOT_FILES]), catalog: false }),
});

/** The catalog entries for `codes`, in the catalog's own text, keyed by top-level line. */
export function catalogSlice(text, codes) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n(?=[A-Z][A-Z0-9_]+:\n)/);
  const byCode = new Map(blocks.map((b) => [b.slice(0, b.indexOf(':')), b.replace(/\s+$/, '')]));
  return `${[...codes].sort().map((code) => {
    if (!byCode.has(code)) throw new Error(`${CATALOG} has no entry for ${code}`);
    return byCode.get(code);
  }).join('\n\n')}\n`;
}

/** {relative path: expected text} of one bundle. */
export function expectedBundle(bundle) {
  const spec = BUNDLES[bundle];
  if (!spec) throw new Error(`no bundle ${bundle}`);
  const out = new Map();
  for (const file of spec.files) out.set(file, fs.readFileSync(path.join(runtimeRoot, file), 'utf8'));
  if (spec.catalog) out.set(CATALOG, catalogSlice(fs.readFileSync(path.join(runtimeRoot, CATALOG), 'utf8'), CHECK_CODES));
  return out;
}

const listed = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listed(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')]));

/** The differences between every copy on disk and what it should be: missing, stale, extra (prefixed by the bundle). */
export function driftOfRuntime() {
  const problems = [];
  for (const bundle of Object.keys(BUNDLES)) {
    const bundleRoot = path.join(runtimeRoot, bundle);
    const expected = expectedBundle(bundle);
    for (const [file, text] of expected) {
      const target = path.join(bundleRoot, file);
      if (!fs.existsSync(target)) problems.push(`missing ${bundle}/${file}`);
      else if (fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== text.replace(/\r\n/g, '\n')) problems.push(`stale ${bundle}/${file}`);
    }
    if (fs.existsSync(bundleRoot)) for (const file of listed(bundleRoot)) if (!expected.has(file)) problems.push(`extra ${bundle}/${file}`);
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const problems = driftOfRuntime();
    for (const p of problems) process.stderr.write(`runtime copy drift: ${p} (run node packages/hfs/scripts/sync-runtime.mjs)\n`);
    if (!problems.length) process.stdout.write(`OK: ${Object.keys(BUNDLES).length} runtime copies match the runtime\n`);
    process.exitCode = problems.length ? 1 : 0;
  } else {
    let count = 0;
    for (const bundle of Object.keys(BUNDLES)) {
      const bundleRoot = path.join(runtimeRoot, bundle);
      fs.rmSync(bundleRoot, { recursive: true, force: true });
      for (const [file, text] of expectedBundle(bundle)) {
        const target = path.join(bundleRoot, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, text);
        count += 1;
      }
    }
    process.stdout.write(`runtime copies synced: ${count} files in ${Object.keys(BUNDLES).length} bundles\n`);
  }
}
