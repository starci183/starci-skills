// Every reference an operator reads is named by an alias that refs.json resolves to an exact
// location. An operator declares its aliases in operator.json (`refs`), and its context.md states
// the same table for the reader. This script rejects an alias nobody registered, a required alias
// the context table omits, a writer that is not an operator, and a context row that names an alias
// the operator did not declare. Disk existence is not checked here: most locations are
// machine-local (`.worktrees`, `.workspaces/local`) and absent on a fresh clone by design.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(await readFile(path.join(root, 'refs.json'), 'utf8'));
const errors = [];

if (registry.schemaVersion !== 8) errors.push('refs.json: schemaVersion must be 8');
const aliases = registry.aliases ?? {};
const KINDS = new Set(['file', 'dir', 'checkout', 'service', 'caller-supplied']);
for (const [alias, def] of Object.entries(aliases)) {
  if (!/^@[a-z][a-z-]*(?:\/[a-z_][a-z0-9_-]*)*$/.test(alias)) errors.push(`refs.json: alias ${alias} must look like @name or @name/sub/path`);
  for (const key of ['params', 'kind', 'resolvesTo', 'scheme', 'bind', 'writers', 'purpose']) {
    if (def[key] === undefined) errors.push(`refs.json: ${alias} lacks ${key}`);
  }
  if (!KINDS.has(def.kind)) errors.push(`refs.json: ${alias} kind ${def.kind} is not one of ${[...KINDS].join(', ')}`);
  for (const p of def.params ?? []) {
    if (!def.resolvesTo.includes(`<${p}>`) && !def.resolvesTo.includes(`${p}/`) && !def.resolvesTo.includes(`/${p}`)) {
      errors.push(`refs.json: ${alias} declares param ${p} that resolvesTo never uses`);
    }
  }
}

const operatorsDir = path.join(root, 'operators');
const operatorIds = new Set();
const manifests = [];
for (const entry of await readdir(operatorsDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = path.join(operatorsDir, entry.name);
  const manifest = JSON.parse(await readFile(path.join(dir, 'operator.json'), 'utf8'));
  operatorIds.add(manifest.id);
  manifests.push({ dir, manifest });
}
for (const [alias, def] of Object.entries(aliases)) {
  for (const w of def.writers ?? []) {
    if (w !== '*' && !operatorIds.has(w)) errors.push(`refs.json: ${alias} names writer ${w}, which is not an operator`);
  }
}

// A context table row: | `@alias/...` | resolves to | bind | Required/Optional |
const ROW = /^\|\s*`(@[a-z][a-z-]*(?:\/[A-Za-z0-9_<>.@#:-]+)*)`\s*\|/;
// The registered alias an alias string belongs to is its longest registered prefix.
const baseOf = (alias) => Object.keys(aliases).filter((k) => alias === k || alias.startsWith(`${k}/`)).sort((a, b) => b.length - a.length)[0] ?? null;
function tableAliases(text, heading) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i += 1) {
    const m = ROW.exec(lines[i]);
    if (m) out.push(m[1]);
  }
  return out;
}

let declared = 0;
for (const { dir, manifest } of manifests) {
  const id = manifest.id;
  const refs = manifest.refs;
  if (!Array.isArray(refs) || refs.length === 0) { errors.push(`${id}: operator.json must declare refs`); continue; }
  const seen = new Set();
  for (const ref of refs) {
    const base = baseOf(ref.alias ?? '');
    if (!base) errors.push(`${id}: ref ${ref.alias} is not registered in refs.json`);
    if (typeof ref.required !== 'boolean') errors.push(`${id}: ref ${ref.alias} must say required true or false`);
    if (typeof ref.purpose !== 'string' || ref.purpose.length === 0) errors.push(`${id}: ref ${ref.alias} needs a purpose`);
    if (seen.has(ref.alias)) errors.push(`${id}: ref ${ref.alias} is declared twice`);
    seen.add(ref.alias);
    declared += 1;
  }
  if (!refs.some((r) => /^@artifacts\b/.test(r.alias) && r.required)) {
    errors.push(`${id}: @artifacts must be a required ref; it is the only place an operator writes`);
  }
  // execute.md routes by alias: every @alias in the Sequence table's Reads/Writes cells must be a
  // declared ref, and every required ref must be read or written by some step. A step that names a
  // location the operator never declared is how an agent wanders outside its region.
  for (const [file, heading] of [['execute.md', '## Sequence'], ['execute.vi.md', '## Trình tự']]) {
    const text = await readFile(path.join(dir, file), 'utf8');
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex((l) => l.trim() === heading);
    if (start === -1) { errors.push(`${id}: ${file} has no ${heading} section`); continue; }
    const used = new Set();
    for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i += 1) {
      const cells = lines[i].split('|').map((c) => c.trim());
      if (cells.length < 6 || !/^\d+$/.test(cells[1])) continue;
      for (const cell of [cells[3], cells[4]]) for (const m of cell.matchAll(/@[a-z][a-z-]*(?:\/[A-Za-z0-9_<>.@#:-]+)*/g)) { const b = baseOf(m[0]); used.add(b ?? m[0]); }
    }
    const declaredBases = new Set(refs.map((r) => baseOf(r.alias)));
    for (const u of used) if (!declaredBases.has(u)) errors.push(`${id}: ${file} Sequence reads or writes ${u}, which operator.json does not declare`);
    for (const r of refs) {
      const b = baseOf(r.alias);
      if (r.required && !used.has(b)) errors.push(`${id}: ${file} Sequence never reads or writes required ${r.alias}`);
    }
    if (used.size === 0) errors.push(`${id}: ${file} Sequence names no alias at all`);
  }
  for (const [file, heading] of [['context.md', '## Refs'], ['context.vi.md', '## Ref']]) {
    const text = await readFile(path.join(dir, file), 'utf8');
    const rows = tableAliases(text, heading);
    if (rows === null) { errors.push(`${id}: ${file} has no ${heading} section`); continue; }
    const declaredAliases = new Set(refs.map((r) => r.alias));
    for (const r of refs) if (r.required && !rows.includes(r.alias)) errors.push(`${id}: ${file} ${heading} table omits required ${r.alias}`);
    for (const row of rows) if (!declaredAliases.has(row)) errors.push(`${id}: ${file} ${heading} table names ${row}, which operator.json does not declare`);
  }
}

if (errors.length > 0) {
  process.stderr.write(`${errors.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`refs closed: ${Object.keys(aliases).length} aliases, ${declared} bindings across ${manifests.length} operators\n`);
}
