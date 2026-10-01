#!/usr/bin/env node
// sync-runtime.mjs - refreshes the self-contained copies of the runtime files the published packages read, so each package
// works in a product repository that has no runtime checkout. Every copy mirrors the runtime layout (engine/,
// scripts/lib/, knowledge/hfs/, modules/kernel/) byte for byte, so the imports need no rewriting.
//   packages/hfs/runtime         what `hfs` reads (with the one Sonar gate, knowledge/sonar-gate.yaml, whose name hfs check holds a stack declaration to): the slot loader, the check, the architecture machine and every file either
//                                imports (computed from the import graph, not listed), plus the failure-code catalog slice
//                                holding exactly the codes `hfs check` can emit (its own and the machine's rule id lists)
//   packages/eslint/be/runtime   what @starci/eslint-canon-be reads through lib/hfs.mjs (loadHfs: slots, hfs.json, the view) and the project graph
//                                (scripts/lib/project-rule.mjs -> project-graph.mjs -> the architecture machine) its project rules share
//   packages/eslint/fe/runtime   the same files for @starci/eslint-canon-fe (lib/hfs.mjs, lib/params.mjs)
//   node packages/hfs/scripts/sync-runtime.mjs [--check]     --check exits 1 when a copy differs; npm run check judges the same
//                                                            differences as RT_GENERATED_DRIFT (scripts/hfs/runtime-check.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_CHECK_CODES } from '../../../scripts/lib/hfs-check.mjs';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** The runtime files the slot resolver needs; both bundles carry them. */
const SLOT_FILES = [
  'engine/runtime-root.mjs',
  'engine/yaml.mjs',
  'engine/plain-object.mjs',
  'scripts/lib/glob.mjs',
  'scripts/lib/path-key.mjs',
  'scripts/lib/hfs-slots.mjs',
  'scripts/lib/hfs-view.mjs',
  'scripts/lib/hfs-allows.mjs',
  'knowledge/hfs/slots.yaml',
];
/** The entry modules of `hfs check`; everything they import, statically, is bundled. */
const CHECK_ENTRIES = ['scripts/lib/hfs-check.mjs', 'scripts/checks/architecture.mjs'];
/** Static imports and `new URL(<relative>.yaml, import.meta.url)` reads (the framework-pinned knowledge file) are followed. */
const IMPORT_SPEC = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"](\.[^'"]+)['"]/g;
/** A read of the migration DDL of one store: `migrations/runtime` or `migrations/machine`. */
const MIGRATION_STORE = /migrations[\/'", ]+(runtime|machine)/g;
const URL_SPEC = /new URL\(\s*['"](\.[^'"]+\.ya?ml)['"]\s*,\s*import\.meta\.url/g;

/** The runtime-relative files reachable from `entries` through relative imports and `new URL(..., import.meta.url)` reads. */
export function importClosure(entries) {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    if (!fs.existsSync(path.join(runtimeRoot, file))) throw new Error(`${file} is imported by the bundled check but does not exist`);
    seen.add(file);
    if (!file.endsWith('.mjs')) return;
    const text = fs.readFileSync(path.join(runtimeRoot, file), 'utf8');
    for (const match of [...text.matchAll(IMPORT_SPEC), ...text.matchAll(URL_SPEC)]) visit(path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1])));
    // A module that reads its DDL from engine/migrations/<store>/ (ledger-db, machine-db) carries every migration of that store.
    for (const store of new Set([...text.matchAll(MIGRATION_STORE)].map((match) => match[1]))) {
      const dir = `engine/migrations/${store}`;
      if (fs.existsSync(path.join(runtimeRoot, dir))) for (const sql of fs.readdirSync(path.join(runtimeRoot, dir)).filter((name) => name.endsWith('.sql')).sort()) visit(`${dir}/${sql}`);
    }
  };
  for (const entry of entries) visit(entry);
  return [...seen].sort();
}

export const CATALOG = 'modules/kernel/failure-codes.yaml';
/**
 * Data files the architecture machine reads at run time beside its code, which a canon bundle must carry because the
 * canons run the machine behind the project-graph law: the managed package-scripts templates (README script names) and
 * the pin and Sonar gate declarations. Without them the canon's rules fail to load outside the runtime checkout.
 */
const MACHINE_DATA = Object.freeze(['packages/hfs/templates/app/package-scripts/package.json', 'knowledge/hfs/canon-pins.yaml', 'knowledge/sonar-gate.yaml']);
/** bundle directory (runtime-relative) -> the files it copies and whether it carries the failure-code slice. */
export const BUNDLES = Object.freeze({
  'packages/hfs/runtime': Object.freeze({ files: Object.freeze([...new Set([...SLOT_FILES, ...importClosure(CHECK_ENTRIES), 'knowledge/hfs/canon-pins.yaml', 'knowledge/sonar-gate.yaml'])].sort()), catalog: true }),
  'packages/eslint/be/runtime': Object.freeze({ files: Object.freeze([...new Set([...SLOT_FILES, ...importClosure(['scripts/lib/recorded-lines.mjs', 'scripts/lib/language.mjs', 'scripts/lib/project-rule.mjs']), ...MACHINE_DATA])].sort()), catalog: false }),
  'packages/eslint/fe/runtime': Object.freeze({ files: Object.freeze([...new Set([...SLOT_FILES, ...importClosure(['scripts/lib/recorded-lines.mjs', 'scripts/lib/next-contract.mjs', 'scripts/lib/language.mjs', 'scripts/lib/project-rule.mjs']), ...MACHINE_DATA])].sort()), catalog: false }),
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
  if (spec.catalog) out.set(CATALOG, catalogSlice(fs.readFileSync(path.join(runtimeRoot, CATALOG), 'utf8'), ALL_CHECK_CODES));
  return out;
}

const listed = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listed(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).split(path.sep).join('/')]));

/** The finding code of a generated copy that differs from what this script writes (rule R121, judged by scripts/hfs/runtime-check.mjs). */
export const GENERATED_DRIFT = 'RT_GENERATED_DRIFT';

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
    for (const p of problems) process.stderr.write(`${GENERATED_DRIFT} runtime copy drift: ${p} (run node packages/hfs/scripts/sync-runtime.mjs)\n`);
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
