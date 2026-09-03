// Every reference an operator reads is named by an alias that alias/alias.json resolves to an exact
// location. An operator declares its aliases in operator.json (`refs`), and its context.md states
// the same table for the reader. This script rejects an alias nobody registered, a required alias
// the context table omits, a writer that is not an operator, and a context row that names an alias
// the operator did not declare. Disk existence is not checked here: most locations are
// machine-local (`.worktrees`, `.workspaces/local`) and absent on a fresh clone by design.
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { loadAliasRegistry, baseOf as baseOfIn } from './alias-registry.mjs';
import { parseOperatorMd, cellAliases, isYes } from './operator-md.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = await loadAliasRegistry(root);
const errors = [];

if (registry.schemaVersion !== 8) errors.push('alias.json: schemaVersion must be 8');
const aliases = registry.aliases ?? {};
const KINDS = new Set(['file', 'dir', 'checkout', 'service', 'caller-supplied', 'tool']);
for (const [alias, def] of Object.entries(aliases)) {
  if (!/^@[a-z][a-z-]*(?:\/[a-z_][a-z0-9_-]*)*$/.test(alias)) errors.push(`alias.json: alias ${alias} must look like @name or @name/sub/path`);
  for (const key of ['params', 'kind', 'resolvesTo', 'scheme', 'bind', 'writers', 'purpose']) {
    if (def[key] === undefined) errors.push(`alias.json: ${alias} lacks ${key}`);
  }
  if (!KINDS.has(def.kind)) errors.push(`alias.json: ${alias} kind ${def.kind} is not one of ${[...KINDS].join(', ')}`);
  for (const p of def.params ?? []) {
    if (!def.resolvesTo.includes(`<${p}>`) && !def.resolvesTo.includes(`${p}/`) && !def.resolvesTo.includes(`/${p}`)) {
      errors.push(`alias.json: ${alias} declares param ${p} that resolvesTo never uses`);
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
    if (w !== '*' && !operatorIds.has(w)) errors.push(`alias.json: ${alias} names writer ${w}, which is not an operator`);
  }
}

// A context table row: | `@alias/...` | resolves to | bind | Required/Optional |
const ROW = /^\|\s*`(@[a-z][a-z-]*(?:\/[A-Za-z0-9_<>.@#:-]+)*)`\s*\|/;
// The registered alias an alias string belongs to is its longest registered prefix.
const baseOf = (alias) => baseOfIn(aliases, alias);
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

// An operator.md package declares its aliases in the Context table and routes by them in the Steps
// table; both languages are checked. Dynamic inputs are kinds, not aliases, so the @dynamic rule of
// the old shape does not apply.
async function checkOperatorMd(dir, id) {
  let count = 0;
  const seen = new Set();
  const en = parseOperatorMd(await readFile(path.join(dir, 'operator.md'), 'utf8'), 'en');
  const rows = en.tables.context?.rows ?? [];
  if (rows.length === 0) { errors.push(`${id}: operator.md Context table is empty`); return 0; }
  const declaredBases = new Set();
  const requiredBases = new Set();
  for (const row of rows) {
    const alias = cellAliases(row.alias)[0];
    if (!alias) { errors.push(`${id}: operator.md Context row "${row.alias}" names no alias`); continue; }
    const base = baseOf(alias);
    if (!base) errors.push(`${id}: ref ${alias} is not registered in alias/alias.json`);
    if (seen.has(alias)) errors.push(`${id}: ref ${alias} is declared twice`);
    seen.add(alias);
    if (base) { declaredBases.add(base); if (isYes(row.required)) requiredBases.add(base); }
    count += 1;
  }
  // @tools/<id> in a Steps cell is a call, not a read: it must be declared in operator.json → resources.tools.
  const manifest = JSON.parse(await readFile(path.join(dir, 'operator.json'), 'utf8'));
  const declaredTools = new Set(Object.keys(manifest.resources?.tools ?? {}));
  for (const [file, lang] of [['operator.md', 'en'], ['operator.vi.md', 'vi']]) {
    if (!existsSync(path.join(dir, file))) continue;
    const text = await readFile(path.join(dir, file), 'utf8');
    const op = lang === 'en' ? en : parseOperatorMd(text, 'vi');
    const used = new Set();
    const toolsUsed = new Set();
    // A tool is used where the operator's law names it: a Steps cell or the prose that states the job
    // the tool serves. Either way it must exist in the registry and be declared in operator.json.
    for (const m of text.matchAll(/@tools\/[a-z][a-z0-9-]*/g)) {
      toolsUsed.add(m[0]);
      if (!aliases[m[0]]) errors.push(`${id}: ${file} names ${m[0]}, which resources/tools.json does not define`);
      else if (!declaredTools.has(m[0])) errors.push(`${id}: ${file} names ${m[0]}, which operator.json resources.tools does not declare`);
    }
    for (const step of op.tables.steps?.rows ?? []) for (const a of [...cellAliases(step.reads), ...cellAliases(step.writes)]) {
      if (a.startsWith('@dynamic')) { errors.push(`${id}: ${file} step ${step.n} names ${a}; an operator.md package passes dynamic files as kinds, not aliases`); continue; }
      if (a.startsWith('@tools/')) { toolsUsed.add(a); if (!aliases[a]) errors.push(`${id}: ${file} step ${step.n} names ${a}, which resources/tools.json does not define`); else if (!declaredTools.has(a)) errors.push(`${id}: ${file} step ${step.n} calls ${a}, which operator.json resources.tools does not declare`); continue; }
      used.add(baseOf(a) ?? a);
    }
    if (lang === 'en') for (const t of declaredTools) if (!toolsUsed.has(t) && t !== '@tools/fileread') errors.push(`${id}: operator.json declares ${t} but the operator's law names it nowhere`);
    for (const u of used) if (!declaredBases.has(u)) errors.push(`${id}: ${file} Steps read or write ${u}, which the Context table does not declare`);
    for (const r of requiredBases) if (!used.has(r)) errors.push(`${id}: ${file} Steps never read or write required ${r}`);
    if (used.size === 0) errors.push(`${id}: ${file} Steps name no alias at all`);
  }
  return count;
}

let declared = 0;
for (const { dir, manifest } of manifests) {
  const id = manifest.id;
  if (existsSync(path.join(dir, 'operator.md'))) { declared += await checkOperatorMd(dir, id); continue; }
  const refs = manifest.refs;
  if (!Array.isArray(refs) || refs.length === 0) { errors.push(`${id}: operator.json must declare refs`); continue; }
  const seen = new Set();
  for (const ref of refs) {
    const base = baseOf(ref.alias ?? '');
    if (!base) errors.push(`${id}: ref ${ref.alias} is not registered in alias/alias.json`);
    if (typeof ref.required !== 'boolean') errors.push(`${id}: ref ${ref.alias} must say required true or false`);
    if (typeof ref.purpose !== 'string' || ref.purpose.length === 0) errors.push(`${id}: ref ${ref.alias} needs a purpose`);
    if (seen.has(ref.alias)) errors.push(`${id}: ref ${ref.alias} is declared twice`);
    seen.add(ref.alias);
    declared += 1;
  }
  if (!refs.some((r) => r.alias.startsWith('@dynamic/') && r.required)) {
    errors.push(`${id}: a required @dynamic/<file> ref is missing; every step writes its receipt there`);
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
  process.stdout.write(`alias closed: ${Object.keys(aliases).length} aliases, ${declared} bindings across ${manifests.length} operators\n`);
}
