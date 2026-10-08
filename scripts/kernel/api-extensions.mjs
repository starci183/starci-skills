// api-extensions.mjs — the conflict-free way to grow the kernel api (lane land-throughput, 2026-09-28).
//
// Every lane that added a verb, a boolean flag or a status field edited the same few shared lines of
// scripts/kernel/cli.mjs (the boolean-flag list, KERNEL_ONLY_VERBS, the `required` map, the dispatch switch,
// usage(), cmdStatus's `out` line), of modules/kernel/api.yaml (`commands:` tail) and of the CLI dispatcher (the
// verb help line), so each land invalidated every queued lane. New work goes through files instead, one per
// thing, discovered at startup:
//
//   scripts/kernel/verbs/<verb>.mjs      a verb: export default {verb, required?, kernelOnly?, reads?, reacts?, flags?, ledger?, usage, run}
//                                            required: [flag] or (args) => [flag]; flags: its boolean flags;
//                                            ledger false: run without opening the repo ledger;
//                                            reads true: a read verb, opened read-only (a write attempt fails the call with read-verb-write);
//                                            reacts true: its mechanical reactions run on a writable ledger for the roles that own them only;
//                                            run({ledger, args, repo, emit, need, caller, ext}) (may be async)
//   modules/cli/commands/kernel/<verb>.yaml  its catalog contract (what `commands.<verb>` of api.yaml would hold)
//   scripts/kernel/status/<key>.mjs      a status field: export default {key, compute(ctx), lines?(value)}
//                                            ctx {ledger, db, wf, workflowId, args, repo, now, core}; a null/undefined
//                                            value adds nothing; `lines` adds human lines to `starci kernel status`
//   scripts/kernel/api-boolean-flags.txt     one boolean flag per line (any verb); merge=union, order free
//
// The verbs, flags and fields already in cli.mjs stay where they are; check-cli-parity reads both.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { eachInOrder } from '../lib/in-order.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERBS_DIR = 'scripts/kernel/verbs';
const STATUS_DIR = 'scripts/kernel/status';
const FLAGS_FILE = 'scripts/kernel/api-boolean-flags.txt';
const SLUG = /^[a-z][a-z0-9-]*$/;

const modulesIn = (dir) => {
  try { return fs.readdirSync(dir).filter((n) => n.endsWith('.mjs') && !n.startsWith('_')).sort(); } catch { return []; }
};

// `/#.*$/` without a regex: `.` never crosses a line terminator, so the match is the first '#'
// whose tail to the very end is terminator-free — the first '#' after the string's last one.
const stripComment = (l) => {
  const marks = [...l.matchAll(/[\n\r\u2028\u2029]/g)];
  const open = l.indexOf('#', (marks.at(-1)?.index ?? -1) + 1);
  return open < 0 ? l : l.slice(0, open);
};

/** The boolean flags of the flags file: one per line, `#` comments and blanks ignored. */
export function readFlagsFile(file) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return []; }
  return text.split(/\r?\n/).map((l) => stripComment(l).trim().replace(/^--/, '')).filter((l) => SLUG.test(l));
}

/** The verb names the verb directory declares (file names), without importing them. */
export const extensionVerbNames = (root) => modulesIn(path.join(root, VERBS_DIR)).map((n) => n.slice(0, -4)).filter((n) => SLUG.test(n));

/**
 * Load every extension under `root` (default: this runtime tree). Returns {verbs: Map<verb, spec>, flags: Set,
 * kernelOnly: Set, status: [{key, compute, lines}], problems: [string]}. A module that fails to load or
 * declares a verb other than its file name is a problem, never a crash of the api.
 */
/** One verb file's extension entry, or a problem string in `out`. A bad module never crashes the api. */
async function loadVerb(root, name, out) {
  const verb = name.slice(0, -4);
  try {
    const spec = (await import(pathToFileURL(path.join(root, VERBS_DIR, name)).href)).default;
    if (!spec || spec.verb !== verb || typeof spec.run !== 'function') { out.problems.push(`${VERBS_DIR}/${name}: default export must be {verb: '${verb}', run, ...}`); return; }
    out.verbs.set(verb, spec);
    for (const f of Array.isArray(spec.flags) ? spec.flags : []) out.flags.add(String(f).replace(/^--/, ''));
    if (spec.kernelOnly) out.kernelOnly.add(verb);
  } catch (error) { out.problems.push(`${VERBS_DIR}/${name}: ${String(error?.message ?? error).slice(0, 200)}`); }
}

/** One status file's extension entry, or a problem string in `out`. */
async function loadStatus(root, name, out) {
  try {
    const spec = (await import(pathToFileURL(path.join(root, STATUS_DIR, name)).href)).default;
    if (!spec || typeof spec.key !== 'string' || typeof spec.compute !== 'function') { out.problems.push(`${STATUS_DIR}/${name}: default export must be {key, compute}`); return; }
    out.status.push(spec);
  } catch (error) { out.problems.push(`${STATUS_DIR}/${name}: ${String(error?.message ?? error).slice(0, 200)}`); }
}

export async function loadApiExtensions({ root = path.resolve(HERE, '..', '..') } = {}) {
  const out = { verbs: new Map(), flags: new Set(readFlagsFile(path.join(root, FLAGS_FILE))), kernelOnly: new Set(), status: [], problems: [] };
  // Sequential on purpose: a later module's import sees the earlier modules' side effects in order.
  await eachInOrder(modulesIn(path.join(root, VERBS_DIR)), (name) => loadVerb(root, name, out));
  await eachInOrder(modulesIn(path.join(root, STATUS_DIR)), (name) => loadStatus(root, name, out));
  return out;
}

/** The required flags of an extension verb for these args. */
export const requiredOf = (spec, args) => {
  if (typeof spec.required === 'function') return spec.required(args);
  return Array.isArray(spec.required) ? spec.required : [];
};

/**
 * The status fields every status extension adds for one workflow: {fields, lines}. A field the core status
 * already has is never overwritten; a compute that throws becomes `<key>Error`.
 */
export function statusExtras(status, ctx, core = {}) {
  const fields = {}, lines = [];
  for (const spec of status) {
    if (Object.hasOwn(core, spec.key)) continue;
    let value;
    // `core`: the status the api already built (frontier, legs, ramThrottle, poolLoad, stuck ...), read-only.
    try { value = spec.compute({ ...ctx, core }); } catch (error) { fields[`${spec.key}Error`] = String(error?.message ?? error).slice(0, 300); continue; }
    if (value === null || value === undefined) continue;
    fields[spec.key] = value;
    if (typeof spec.lines === 'function') { try { lines.push(...(spec.lines(value) ?? [])); } catch { /* the field stands */ } }
  }
  return { fields, lines };
}

/** The usage lines of the extension verbs, for `api --help`. A verb split out of cli.mjs keeps its line
 * in that file's usage() (`usageInCore: true`) and prints nothing here, so `api --help` is unchanged. */
export const extensionUsage = (ext) => [...ext.verbs.values()].filter((s) => s.usageInCore !== true)
  .map((s) => String(s.usage ?? `  ${s.verb}`).trimEnd());
