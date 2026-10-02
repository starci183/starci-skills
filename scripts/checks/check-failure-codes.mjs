#!/usr/bin/env node
// failure-codes.mjs — the emitted-code scanner and the catalog checker (part of `npm run check`).
//   starci runtime check --only failure-codes -- [--json] [--list]
//
// Every code the runtime can emit as a verdict reason, a check finding, a blocker kind, a dispatch refusal or a settle
// reason is a string literal in scripts/ engine/ modules/. modules/kernel/failure-codes.yaml is the owner-facing catalog
// (one entry per code: title, meaning, causes, next step, owner). This checker refuses:
//   - an emitted code that has no catalog entry (a new code must be explained the day it is added),
//   - a catalog entry no code emits any more (a retired code leaves the catalog),
//   - an entry with a missing or malformed field, or an owner outside the closed set,
//   - a code whose only literal source is the rule catalog (knowledge/hfs/rules.yaml) and that no lint plugin or Sonar enforcer of
//     a rule reports: a catalog line is not an emitter, so a rule code needs a built plugin enforcer or a literal in code.
// The findings carry stable codes (scripts/lib/failure-code-findings.mjs): RT_CODE_UNCATALOGUED, RT_CODE_STALE, RT_CODE_MALFORMED,
// RT_CODE_SOLE_EMITTER.
// What counts as an emitted code (see `emittedCodes`):
//   UPPER  a quoted UPPER_SNAKE literal of two or more segments ('TARGET_MISSING'), except the names in the not-codes
//          section of modules/kernel/allowlist.yaml (environment variables, Node/SQLite error names, key names)
//          and any name the code itself reads as an env var;
//   KEBAB  a kebab-case literal with a hyphen in a code position: `code: 'x-y'`, `reason: 'x-y'`, `rejected: 'x-y'`,
//          a reason template that starts with one (`reason: \`x-y:${...}\``), or the last string argument of refuse(...).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { readAllowlist } from '../lib/allowlist.mjs';
import { FAILURE_CODE_VIETNAMESE_FIELDS } from '../lib/language.mjs';
import { createRequire } from 'node:module';
import { isMain } from '../lib/is-main.mjs';
import { CODE_FINDINGS, PLUGIN_ENFORCERS } from '../lib/failure-code-findings.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CATALOG_FILE = 'modules/kernel/failure-codes.yaml';
const OWNERS = Object.freeze(['op-retry', 'runtime-core', 'supervisor', 'owner']);
/** other-op:<op> is also an owner: the finding is another op's to fix. */
const ownerValid = (owner) => OWNERS.includes(owner) || /^other-op:[a-z][a-z0-9.-]*$/.test(String(owner ?? ''));
const SCAN_DIRS = ['scripts', 'engine', 'modules'];
// The HFS rule catalog names the code of every rule, including rules whose checker is still owed, so it emits them too.
const SCAN_FILES = ['knowledge/hfs/rules.yaml'];
const SCAN_EXT = /\.(mjs|yaml)$/;
// The scanner does not read its own catalog checker, the catalog, or the ui/ harness.
const SKIP_FILES = new Set([CATALOG_FILE, 'scripts/checks/check-failure-codes.mjs']);

/** UPPER_SNAKE literals that are not codes: environment variables, Node/SQLite error names, settings and key names. */
const NOT_CODE_PREFIX = /^(ORCA|NODE|CODEX|CLAUDE|OPENAI|CLOUDFLARE|TELEGRAM|SONAR|ANTHROPIC|GITHUB|GIT|DEVIN|LOCALAPPDATA|APPDATA|USERPROFILE|HTTP|SQLITE|ERR)_/;
const readNotCodes = (base) => new Set(readAllowlist('not-codes', base).map((entry) => entry.literal));

const skipDir = (name) => name === 'node_modules' || name === '.git' || name === 'dist';
function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) { if (!skipDir(e.name)) yield* walk(path.join(dir, e.name)); }
    else if (SCAN_EXT.test(e.name)) yield path.join(dir, e.name);
  }
}

const UPPER_RE = /(['"`])([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\1/g;
const KEBAB = '[a-z][a-z0-9]*(?:-[a-z0-9]+)+';
// A bracketed code in text: a message prefix ('[TARGET_MISSING] ...'), a comment or a YAML flow list. In JavaScript a
// bracket around one identifier is code, not text: an element access (`baseline[KEY]`), an array literal (`[ROOT]`)
// or a computed key (`{ [KEY]: v }`) reads a constant and emits nothing; `codeBrackets` finds those by parsing.
const BRACKET_RE = /\[([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\]/g;
const KEBAB_RES = [
  new RegExp(`\\b(?:code|reason|rejected|failureCode|failureKind|signal|blocker)\\s*:\\s*(['"])(${KEBAB})\\1`, 'g'),
  new RegExp(`\\breason\\s*:\\s*\`(${KEBAB})(?=[:\`$])`, 'g'),
  new RegExp(`\\brefuse\\((?:[^;]*?),\\s*(['"])(${KEBAB})\\1`, 'g'),
  new RegExp(`\\bhand\\(\\s*(['"])(${KEBAB})\\1`, 'g'),
];
// A constant list of reasons/codes/classes: Object.freeze(['a-b', 'c-d']) or ['a-b'].
const LIST_RE = /\b[A-Z][A-Z0-9_]*_(?:REASONS|CODES|KINDS|CLASSES)\s*=\s*(?:Object\.freeze\()?\[([^\]]*)\]/g;

/** Closed vocabularies that are verdict reasons too: blocker kinds, failure classes, route verdicts (modules/models/kinds.yaml) and the ledger's own attempt/check enums (0001-init.sql). Keyed `<family>:<value>`. */
function vocabularyCodes(base = root) {
  const out = [];
  const kinds = parseYaml(fs.readFileSync(path.join(base, 'modules/models/kinds.yaml'), 'utf8'))?.vocabularies ?? {};
  const fam = (prefix, list, file) => { for (const v of Array.isArray(list) ? list : []) out.push({ code: `${prefix}:${v}`, kind: 'vocab', sites: [{ file, line: 1 }] }); };
  fam('blocker', kinds.blockers, 'modules/models/kinds.yaml');
  fam('failure-class', kinds.failureClasses, 'modules/models/kinds.yaml');
  fam('route-verdict', kinds.verdicts, 'modules/models/kinds.yaml');
  const sql = fs.readFileSync(path.join(base, 'engine/db/migrations/runtime/0001-init.sql'), 'utf8');
  const enumOf = (column, table = null) => { const text = table ? sql.slice(sql.indexOf(`CREATE TABLE IF NOT EXISTS ${table}(`)) : sql; const m = text.match(new RegExp(String.raw`\b${column}\s+TEXT[^\n]*?IN\s*\(([^)]*)\)`)); return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : []; };
  fam('end-state', enumOf('end_state'), 'engine/db/migrations/runtime/0001-init.sql');
  fam('attempt-verdict', enumOf('verdict'), 'engine/db/migrations/runtime/0001-init.sql');
  fam('check-status', enumOf('status', 'check_runs'), 'engine/db/migrations/runtime/0001-init.sql');
  return out;
}

const relOf = (file) => path.relative(root, file).split(path.sep).join('/');
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

let typescript = null;
/** Offsets of the `[` of every element access, array literal or computed key whose only content is an identifier. */
function codeBrackets(rel, text) {
  typescript ??= createRequire(import.meta.url)('typescript');
  const ts = typescript;
  const source = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  const out = new Set();
  const bracketBefore = (node) => text.lastIndexOf('[', node.getStart(source));
  const visit = (node) => {
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.argumentExpression)) out.add(bracketBefore(node.argumentExpression));
    else if (ts.isArrayLiteralExpression(node) && node.elements.length === 1 && ts.isIdentifier(node.elements[0])) out.add(node.getStart(source));
    else if (ts.isComputedPropertyName(node) && ts.isIdentifier(node.expression)) out.add(node.getStart(source));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/** Every emitted code: {code, kind: 'upper'|'kebab', sites: [{file, line}]}. Sorted by code. */
export function emittedCodes(base = root) {
  const found = new Map();
  const add = (code, kind, file, line) => {
    const e = found.get(code) ?? { code, kind, sites: [] };
    if (e.sites.length < 6 && !e.sites.some((s) => s.file === file && s.line === line)) e.sites.push({ file, line });
    found.set(code, e);
  };
  const NOT_CODES = readNotCodes(base);
  const envNames = new Set();
  const texts = [];
  for (const file of [...SCAN_DIRS.flatMap((d) => [...walk(path.join(base, d))]), ...SCAN_FILES.map((f) => path.join(base, f)).filter((f) => fs.existsSync(f))]) {
    const rel = path.relative(base, file).split(path.sep).join('/');
    if (SKIP_FILES.has(rel)) continue;
    const text = fs.readFileSync(file, 'utf8');
    texts.push([rel, text]);
    for (const m of text.matchAll(/\b(?:(?:process\.)?env(?:\.|\[\s*['"])|readEnv\(\s*['"])([A-Z][A-Z0-9_]+)/g)) envNames.add(m[1]);
  }
  for (const [rel, text] of texts) {
    for (const m of text.matchAll(UPPER_RE)) {
      const code = m[2];
      if (NOT_CODES.has(code) || NOT_CODE_PREFIX.test(code) || envNames.has(code)) continue;
      add(code, 'upper', rel, lineOf(text, m.index));
    }
    const brackets = [...text.matchAll(BRACKET_RE)];
    const inCode = rel.endsWith('.mjs') && brackets.length ? codeBrackets(rel, text) : null;
    for (const m of brackets) {
      if (inCode?.has(m.index)) continue;
      if (NOT_CODES.has(m[1]) || NOT_CODE_PREFIX.test(m[1]) || envNames.has(m[1])) continue;
      add(m[1], 'upper', rel, lineOf(text, m.index));
    }
    if (!rel.endsWith('.mjs')) continue;
    const addKebab = (code, at) => { if (!NOT_CODES.has(code)) add(code, 'kebab', rel, lineOf(text, at)); };
    for (const m of text.matchAll(LIST_RE)) {
      for (const item of m[1].matchAll(new RegExp(`['"](${KEBAB})['"]`, 'g'))) addKebab(item[1], m.index);
    }
    for (const re of KEBAB_RES) for (const m of text.matchAll(re)) addKebab(m[m.length - 1], m.index);
  }
  for (const v of vocabularyCodes(base)) found.set(v.code, v);
  return [...found.values()].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}

// The entry's scalar fields. Its Vietnamese fields (FAILURE_CODE_VIETNAMESE_FIELDS) are the one declared exception of the English-only document law (HFS_DOC_NOT_ENGLISH); causes_vi is their list companion.
const FIELDS = ['title', ...FAILURE_CODE_VIETNAMESE_FIELDS.filter((field) => field !== 'causes_vi'), 'owner', 'kind'];
const CODE_KINDS = Object.freeze(['check-finding', 'settle-reason', 'dispatch-refusal', 'blocker', 'check-status', 'verb-refusal', 'runtime-fault', 'input-invalid']);

/** Read the catalog: a flat map code -> entry. */
export function readCatalog(base = root) {
  const file = path.join(base, CATALOG_FILE);
  return parseYaml(fs.readFileSync(file, 'utf8')) ?? {};
}

/** The catalog problems: {missing[], stale[], malformed[]}. */
export function catalogProblems(base = root) {
  const catalog = readCatalog(base);
  const emitted = emittedCodes(base);
  const emittedSet = new Set(emitted.map((e) => e.code));
  const missing = emitted.filter((e) => !Object.hasOwn(catalog, e.code));
  const stale = Object.keys(catalog).filter((code) => !emittedSet.has(code));
  const rules = parseYaml(fs.readFileSync(path.join(base, 'knowledge/hfs/rules.yaml'), 'utf8'))?.rules ?? [];
  const pluginReported = new Set(rules.filter((r) => (r.enforcers ?? []).some((e) => PLUGIN_ENFORCERS.includes(e.kind) && !e.status)).flatMap((r) => [r.code, ...(r.failureCodes ?? [])]));
  const soleEmitter = emitted.filter((e) => e.kind === 'upper' && e.sites.every((site) => site.file === 'knowledge/hfs/rules.yaml') && !pluginReported.has(e.code));
  const malformed = [];
  const ops = new Set(fs.readdirSync(path.join(base, 'modules/ops/ops')).filter((n) => n.endsWith('.yaml')).map((n) => n.slice(0, -5)));
  for (const [code, entry] of Object.entries(catalog)) {
    const bad = [];
    for (const f of FIELDS) if (typeof entry?.[f] !== 'string' || !entry[f].trim()) bad.push(`${f} missing`);
    if (String(entry?.owner ?? '').startsWith('other-op:') && !ops.has(entry.owner.slice(9))) bad.push(`owner ${entry.owner} names an op with no modules/ops/ops/<op>.yaml`);
    if (entry?.owner && !ownerValid(entry.owner)) bad.push(`owner '${entry.owner}' is not ${OWNERS.join('|')}|other-op:<op>`);
    if (entry?.kind && !CODE_KINDS.includes(entry.kind)) bad.push(`kind '${entry.kind}' is not ${CODE_KINDS.join('|')}`);
    if (!Array.isArray(entry?.causes_vi) || !entry.causes_vi.length || entry.causes_vi.some((c) => typeof c !== 'string' || !c.trim())) bad.push('causes_vi must be a non-empty list of strings');
    if (bad.length) malformed.push({ code, problems: bad });
  }
  return { emitted: emitted.length, catalog: Object.keys(catalog).length, missing, stale, malformed, soleEmitter };
}

if (isMain(import.meta.url)) {
  if (process.argv.includes('--list')) {
    for (const e of emittedCodes()) console.log(`${e.code}\t${e.kind}\t${e.sites[0].file}:${e.sites[0].line}`);
    process.exit(0);
  }
  const p = catalogProblems();
  const ok = !p.missing.length && !p.stale.length && !p.malformed.length && !p.soleEmitter.length;
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok, ...p }, null, 2));
  else if (ok) console.log(`OK: ${p.emitted} emitted codes, all in ${CATALOG_FILE} (${p.catalog} entries).`);
  else {
    for (const m of p.missing) console.error(`${CODE_FINDINGS.uncatalogued} ${m.code} (${m.sites[0].file}:${m.sites[0].line}): an emitted code with no entry in ${CATALOG_FILE}; add title, title_vi, meaning_vi, causes_vi, nextStep_vi, owner, kind`);
    for (const c of p.stale) console.error(`${CODE_FINDINGS.stale} ${c}: in ${CATALOG_FILE} but no code emits it; remove the entry`);
    for (const e of p.soleEmitter) console.error(`${CODE_FINDINGS.soleEmitter} ${e.code} (${e.sites[0].file}:${e.sites[0].line}): the rule catalog is its only source; build a lint or Sonar enforcer that reports it, or spell it where a check emits it`);
    for (const m of p.malformed) console.error(`${CODE_FINDINGS.malformed} ${m.code}: ${m.problems.join('; ')}`);
  }
  process.exit(ok ? 0 : 1);
}
