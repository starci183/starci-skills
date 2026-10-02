#!/usr/bin/env node
// check-cli-parity.mjs — RT_CLI_VERB_PARITY (R199): the unified CLI catalog of
// modules/cli/commands and the code agree.
//
//   every catalog verb has a handler — its impl.script exists, and a kernel verb
//     resolves inside it (scripts/kernel/verbs/<verb>.mjs, or a `case '<verb>'`
//     of scripts/kernel/cli.mjs) — and a doc (a non-empty summary, flags listed)
//   every kernel verb module has a catalog file, and every `case` verb of
//     cli.mjs's dispatch switch has one
//   every --flag a verb module names — its `usage:` string (usageInCore verbs:
//     the verb's lines of cli.mjs usage()), its `required:` list, and every flag
//     of scripts/kernel/api-boolean-flags.txt (union over the kernel group) — is
//     a flag of its catalog file
//   the app group is compared with the `VERBS` export of packages/hfs/src/main.mjs
//     once CLI-HFS lands it; until the file exists the group is skipped with an
//     explicit skipped line
//
//   starci runtime check --only cli-parity -- [--root <tree>] [--json]
// Exit 0 when catalog and code agree, 1 with the findings, 2 on bad arguments
// or an unreadable source.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';
import { isMain } from '../lib/is-main.mjs';
import { loadCatalog } from '../cli/catalog.mjs';

const RULE = 'RT_CLI_VERB_PARITY';
const GLOBAL_FLAGS = new Set(['json', 'cwd', 'quiet', 'help', 'edition']);

const HELP = `Usage: starci runtime check --only cli-parity -- [--root <tree>] [--json]

${RULE}: catalog <-> implementation parity of modules/cli/commands.
Exit 0 agrees, 1 reports findings, 2 is a bad argument or unreadable source.`;

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INTERNAL_FILE = 'modules/cli/commands/_internal.yaml';
const ENTRY_EXT = /\.(?:[cm]?js|ts|sh)$/;
const ENTRY_ROOT = /^(?:engine|scripts|ui|bin)\//;
const PACKAGE_ENTRY = /^packages\/[^/]+\/(?:bin|src)\//;
const ENTRY_EXEMPT = new Set(['packages/cli/bin/starci.mjs', 'packages/hfs/src/main.mjs']);

class ParityInputError extends Error {}

const read = (file) => {
  try { return fs.readFileSync(file, 'utf8'); } catch { throw new ParityInputError(`unreadable source: ${file}`); }
};

const posix = (file) => String(file).replace(/\\/g, '/');

const codeOnly = (text) => {
  let out = '', state = 'code', escaped = false, inClass = false, significant = '';
  const blank = (char) => (char === '\n' ? '\n' : ' ');
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i], next = text[i + 1];
    if (state === 'line') { if (char === '\n') { state = 'code'; out += '\n'; } else out += ' '; continue; }
    if (state === 'block') { if (char === '*' && next === '/') { out += '  '; i += 1; state = 'code'; } else out += blank(char); continue; }
    if (state === 'quote' || state === 'template') {
      if (escaped) { escaped = false; out += blank(char); continue; }
      if (char === '\\') { escaped = true; out += ' '; continue; }
      const end = state === 'template' ? '`' : significant;
      if (char === end) state = 'code';
      out += blank(char);
      continue;
    }
    if (state === 'regex') {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '[') inClass = true;
      else if (char === ']') inClass = false;
      else if (char === '/' && !inClass) state = 'code';
      out += blank(char);
      continue;
    }
    if (char === '/' && next === '/') { out += '  '; i += 1; state = 'line'; continue; }
    if (char === '/' && next === '*') { out += '  '; i += 1; state = 'block'; continue; }
    if (char === "'" || char === '"') { significant = char; state = 'quote'; out += ' '; continue; }
    if (char === '`') { state = 'template'; out += ' '; continue; }
    if (char === '/' && (!significant || /[=(:,!&|?{};\[\]]/.test(significant))) { state = 'regex'; inClass = false; out += ' '; continue; }
    out += char;
    if (!/\s/.test(char)) significant = char;
  }
  return out;
};

/** True only for the three entry gates owned by the registry contract. */
export function hasEntryGate(source) {
  const text = String(source ?? '');
  if (text.startsWith('#!')) return true;
  const code = codeOnly(text);
  if (/\bisMain\s*\(\s*import\.meta\.url\s*\)/.test(code)) return true;
  // A legacy entry may read argv directly at module scope. Function/default
  // parameters and arrow helpers merely accepting argv are libraries, not mains.
  let depth = 0;
  for (const line of code.split(/\r?\n/)) {
    const before = depth;
    for (const char of line) {
      if (char === '{') depth += 1;
      else if (char === '}') depth = Math.max(0, depth - 1);
    }
    if (before === 0 && /\bprocess\.argv\b/.test(line) && !/\bfunction\b|=>/.test(line)) return true;
  }
  return false;
}

/** Parse _internal.yaml without routing it through the command-catalog loader. */
export function loadInternalRegistry(root = DEFAULT_ROOT) {
  const file = path.join(root, ...INTERNAL_FILE.split('/'));
  let doc;
  try { doc = parseYaml(read(file)); } catch (error) { throw new ParityInputError(`invalid ${INTERNAL_FILE}: ${error.message}`); }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !Array.isArray(doc.internal)) {
    throw new ParityInputError(`${INTERNAL_FILE}: "internal" must be a list`);
  }
  const entries = [];
  for (let i = 0; i < doc.internal.length; i += 1) {
    const item = doc.internal[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ParityInputError(`${INTERNAL_FILE}: internal[${i}] is not a map`);
    const keys = Object.keys(item);
    for (const key of keys) if (!['path', 'why', 'usedBy'].includes(key)) throw new ParityInputError(`${INTERNAL_FILE}: internal[${i}] has unknown key "${key}"`);
    if (typeof item.path !== 'string' || !item.path.trim()) throw new ParityInputError(`${INTERNAL_FILE}: internal[${i}].path must be a non-empty string`);
    if (typeof item.why !== 'string' || !item.why.trim() || /[\r\n]/.test(item.why)) throw new ParityInputError(`${INTERNAL_FILE}: ${item.path}.why must be one short line`);
    if (!Array.isArray(item.usedBy) || !item.usedBy.length || item.usedBy.some((value) => typeof value !== 'string' || !value.trim())) {
      throw new ParityInputError(`${INTERNAL_FILE}: ${item.path}.usedBy must be a non-empty path list`);
    }
    entries.push({ path: posix(item.path), why: item.why, usedBy: item.usedBy.map(posix) });
  }
  return entries;
}

const fallbackFiles = (root) => {
  const out = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else out.push(posix(path.relative(root, file)));
    }
  };
  for (const top of ['engine', 'scripts', 'ui', 'bin', 'packages']) walk(path.join(root, top));
  return out;
};

const trackedFiles = (root) => {
  try { return gitOutputOf(lsFiles(['-z'], { cwd: root, maxBuffer: 64 * 1024 * 1024 }), 'git ls-files -z').split('\0').filter(Boolean).map(posix); }
  catch { return fallbackFiles(root); }
};

const entryCandidate = (file) => ENTRY_EXT.test(file) && (ENTRY_ROOT.test(file) || PACKAGE_ENTRY.test(file));

const filesIn = (dir, rx) => { try { return fs.readdirSync(dir).filter((n) => rx.test(n) && !n.startsWith('_')).sort(); } catch { return []; } };

/** --flag names of a usage string (the global five are the dispatcher's, never a verb's;
 * parenthesized prose and flag-family placeholders like --until-<type> are not flags). */
export const flagsOfUsage = (text) => [...new Set(
    [...String(text ?? '').split(/\s--(?=\s|$)/, 1)[0].replace(/\([^)]*\)/g, ' ').matchAll(/--([a-z][a-z0-9-]*)/g)].map((m) => m[1]))]
  .filter((f) => !GLOBAL_FLAGS.has(f) && !f.endsWith('-'));

/** The verbs cli.mjs's main() dispatch switch can run. */
export const verbsFromSwitch = (source) => [...source.matchAll(/^\s*case '([a-z][a-z0-9-]*)':\s*return\b/gm)].map((m) => m[1]);

/** Per-verb usage lines of the cli.mjs usage() heredoc: {verb: line + continuations}. */
export const usageLinesOf = (source) => {
  const start = source.indexOf('const usage = ');
  if (start < 0) throw new ParityInputError('cli.mjs has no usage() definition');
  const open = source.indexOf('`', start);
  const close = source.indexOf('`', open + 1);
  if (open < 0 || close < 0) throw new ParityInputError('cli.mjs usage() has no template literal');
  const out = {};
  let cur = null;
  for (const raw of source.slice(open + 1, close).split('\n')) {
    const head = /^ {2}([a-z][a-z0-9-]*)(?:\s|$)/.exec(raw);
    if (head) { cur = head[1]; (out[cur] ??= []).push(raw); }
    else if (cur && /^\s{10,}\S/.test(raw)) out[cur].push(raw);
    else cur = null;
  }
  return out;
};

/** The extension verb modules of scripts/kernel/verbs/: {verb: {file, usage, required}}. */
export const kernelVerbModules = (root) => {
  const dir = path.join(root, 'scripts', 'kernel', 'verbs');
  const out = new Map();
  for (const f of filesIn(dir, /^[a-z][a-z0-9-]*\.mjs$/)) {
    const t = read(path.join(dir, f));
    const m = /\b(?:verb:\s*|workflowVerb\(\s*)'([^']+)'/.exec(t);
    if (!m) continue;
    const usage = /\busage:\s*'((?:[^'\\]|\\.)*)'/s.exec(t)?.[1] ?? /\busage:\s*`([\s\S]*?)`/.exec(t)?.[1] ?? null;
    const viaWorkflowVerb = /\bworkflowVerb\(\s*'/.test(t);
    const required = viaWorkflowVerb ? ['workflow'] : [...(t.match(/\brequired:\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((x) => x[1]);
    out.set(m[1], { file: `scripts/kernel/verbs/${f}`, usage, required });
  }
  return out;
};

/** The whole parity report: {ok, findings, skipped, verbs}. */
export function checkCliParity(root = DEFAULT_ROOT, { files = null } = {}) {
  const findings = [];
  const skipped = [];
  const bad = (what, detail) => findings.push({ rule: RULE, what, detail });
  let cat;
  try { cat = loadCatalog(root); } catch (e) {
    if (e?.code === 'catalog-invalid') return { ok: false, findings: (e.errors ?? [e.message]).map((d) => ({ rule: RULE, what: 'catalog', detail: d })), skipped, verbs: [] };
    throw e;
  }
  const groups = new Map(cat.groups.map((g) => [g.group, g]));
  const implScripts = new Set(cat.groups.flatMap((g) => g.verbs.map((v) => v.impl?.script).filter(Boolean).map(posix)));
  const routedEntries = new Set(implScripts);
  for (const group of cat.groups) for (const verb of group.verbs) for (const spelling of verb.removed ?? []) {
    const match = /^node\s+(?:\.claude[\\/])?((?:engine|scripts|ui|bin|packages[\\/][^\\/]+[\\/](?:bin|src))[\\/][^\s"']+)/.exec(spelling);
    if (match) routedEntries.add(posix(match[1]));
  }

  // Every non-public entry point is declared once in _internal.yaml. The
  // registry itself is deliberately outside catalog.mjs: it is not a route.
  let internal = [];
  try { internal = loadInternalRegistry(root); } catch (error) {
    bad('internal', error.message);
  }
  const internalPaths = new Set();
  for (const item of internal) {
    if (internalPaths.has(item.path)) { bad(`internal:${item.path}`, 'internal entry is duplicated'); continue; }
    internalPaths.add(item.path);
    const absolute = path.join(root, ...item.path.split('/'));
    if (!fs.existsSync(absolute)) { bad(`internal:${item.path}`, 'internal entry stale: file does not exist'); continue; }
    if (!hasEntryGate(read(absolute))) bad(`internal:${item.path}`, 'internal entry stale: file has no entry gate');
    if (implScripts.has(item.path)) bad(`internal:${item.path}`, 'internal entry stale: file is also a catalog verb implementation');
  }

  const knownPublic = new Set([...routedEntries, ...ENTRY_EXEMPT]);
  for (const file of files ?? trackedFiles(root)) {
    const rel = posix(file);
    if (!entryCandidate(rel) || knownPublic.has(rel) || rel.startsWith('packages/cli/src/') || internalPaths.has(rel)) continue;
    const absolute = path.join(root, ...rel.split('/'));
    let source;
    try { source = read(absolute); } catch { continue; }
    if (hasEntryGate(source)) bad(`entry:${rel}`, 'entry script is neither a catalog verb nor listed internal');
  }

  // kernel: impl script + resolvable handler (extension module or cli.mjs case)
  const cliFile = path.join(root, 'scripts', 'kernel', 'cli.mjs');
  const cliSource = fs.existsSync(cliFile) ? read(cliFile) : null;
  const switchVerbs = cliSource ? verbsFromSwitch(cliSource) : [];
  const coreUsage = cliSource ? usageLinesOf(cliSource) : {};
  const modules = kernelVerbModules(root);
  const kernel = groups.get('kernel');
  const catalogKernelVerbs = new Map((kernel?.verbs ?? []).map((v) => [v.verb, v]));

  for (const g of cat.groups) {
    for (const v of g.verbs) {
      if (typeof v.summary !== 'string' || !v.summary.trim()) bad(`docs:${g.group}/${v.verb}`, 'catalog verb has no summary');
      if (v.impl?.script && !fs.existsSync(path.join(root, v.impl.script))) bad(`handler:${g.group}/${v.verb}`, `impl script ${v.impl.script} does not exist`);
      if (g.group === 'kernel' && v.impl?.script === 'scripts/kernel/cli.mjs' && !modules.has(v.verb) && !switchVerbs.includes(v.verb)) {
        bad(`handler:kernel/${v.verb}`, 'no verb module and no cli.mjs dispatch case');
      }
    }
  }
  // every kernel verb module and every switch case has a catalog file
  for (const [verb, mod] of modules) if (!catalogKernelVerbs.has(verb)) bad('catalog:kernel', `verb module ${mod.file} has no catalog file`);
  for (const verb of switchVerbs) if (!catalogKernelVerbs.has(verb)) bad('catalog:kernel', `cli.mjs dispatches "${verb}" but no catalog file names it`);

  // flags: usage + required of each module, plus the shared boolean flag file
  const flagNames = (v) => new Set((v?.flags ?? []).map((f) => f.name));
  for (const [verb, mod] of modules) {
    const doc = catalogKernelVerbs.get(verb);
    if (!doc) continue;
    const have = flagNames(doc);
    const inUsage = flagsOfUsage(mod.usage ?? (coreUsage[verb] ?? []).join('\n'));
    for (const f of inUsage) if (!have.has(f)) bad(`flags:kernel/${verb}`, `--${f} of the usage is not a catalog flag`);
    for (const f of mod.required) if (!have.has(f)) bad(`flags:kernel/${verb}`, `required --${f} is not a catalog flag`);
  }
  const boolFile = path.join(root, 'scripts', 'kernel', 'api-boolean-flags.txt');
  if (fs.existsSync(boolFile)) {
    const union = new Set((kernel?.verbs ?? []).flatMap((v) => [...flagNames(v)]));
    for (const line of read(boolFile).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))) {
      if (!union.has(line)) bad('flags:kernel', `api-boolean-flags.txt: --${line} is in no kernel verb's catalog flags`);
    }
  }

  // app group vs the hfs main's VERBS export (CLI-HFS lands packages/hfs/src/main.mjs)
  const appGroup = groups.get('app');
  const hfsMain = path.join(root, 'packages', 'hfs', 'src', 'main.mjs');
  if (appGroup) {
    if (!fs.existsSync(hfsMain)) skipped.push('app: packages/hfs/src/main.mjs does not exist yet (CLI-HFS) — app verb parity skipped');
    else {
      const m = /export const VERBS\s*=\s*(?:Object\.freeze\s*\(\s*)?(\[[\s\S]*?\])/.exec(read(hfsMain));
      const hfsVerbs = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
      const catVerbs = new Set(appGroup.verbs.map((v) => v.verb));
      for (const v of hfsVerbs) if (!catVerbs.has(v)) bad('catalog:app', `hfs verb "${v}" has no catalog file`);
      for (const v of catVerbs) if (!hfsVerbs.includes(v)) bad('handler:app', `catalog verb "${v}" is not an hfs VERBS entry`);
    }
  }
  return { ok: findings.length === 0, rule: RULE, findings, skipped, verbs: cat.groups.flatMap((g) => g.verbs.map((v) => `${g.group} ${v.verb}`)) };
}

export function checkCliParityMain(argv) {
  let root = DEFAULT_ROOT;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help' || key === '-h') return { exitCode: 0, text: `${HELP}\n` };
    if (key === '--json') { json = true; continue; }
    if (key === '--root') {
      const value = argv[++i];
      if (value === undefined) return { exitCode: 2, text: 'check-cli-parity: --root needs a path\n' };
      root = path.resolve(value);
      continue;
    }
    return { exitCode: 2, text: `check-cli-parity: unknown argument ${key}\n${HELP}\n` };
  }
  let report;
  try { report = checkCliParity(root); } catch (error) {
    if (error instanceof ParityInputError) return { exitCode: 2, text: `check-cli-parity: ${error.message}\n` };
    throw error;
  }
  if (json) return { exitCode: report.ok ? 0 : 1, text: `${JSON.stringify(report, null, 2)}\n` };
  const lines = [];
  if (report.ok) lines.push(`check-cli-parity: ${report.verbs.length} catalog verbs, all agree`);
  else {
    lines.push(`check-cli-parity: ${RULE} — ${report.findings.length} parity finding(s)`);
    for (const f of report.findings) lines.push(`  ${f.what}: ${f.detail}`);
  }
  for (const s of report.skipped) lines.push(`  skipped: ${s}`);
  return { exitCode: report.ok ? 0 : 1, text: `${lines.join('\n')}\n` };
}

if (isMain(import.meta.url)) {
  const result = checkCliParityMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
