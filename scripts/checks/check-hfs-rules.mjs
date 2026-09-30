#!/usr/bin/env node
// check-hfs-rules.mjs - holds knowledge/hfs/rules.yaml (the HFS rule catalog) to what exists, in both directions (part of
// `npm run check`).
//   node scripts/checks/check-hfs-rules.mjs [--json] [--unbuilt]
//
// The catalog is loaded through scripts/lib/hfs-slots.mjs (loadRuleCatalog), which refuses a catalog that breaks its schema
// (HFS_RULES_INVALID). On top of that this check refuses:
//   - a rule with no enforcer, or a `lint`/`check` kind with no enforcer of that family        HFS_RULE_NO_ENFORCER
//   - an existing eslint-be / eslint-fe enforcer whose id is not a rule of the plugin in packages/eslint/{be,fe},
//     or an existing machine / hfs / work-validate / sonar enforcer whose file (`at`) is missing or emits none of the
//     rule's codes                                                                            HFS_RULE_ENFORCER_MISSING
//   - a `status: planned` enforcer that already ships: an eslint id the plugin has, or a machine / hfs /
//     work-validate enforcer whose rule code an emitter of that family already emits (drop the status, name `at`)
//                                                                                             HFS_RULE_ENFORCER_STALE
//   - a failure code no enforcer emits while the rule claims every enforcer is built: an eslint or stylelint enforcer
//     emits the rule's own code, a machine / hfs / work-validate emitter emits a code it spells as a string literal
//                                                                                             HFS_RULE_CODE_UNEMITTED
//   - a rule of the eslint plugins that no catalog enforcer names (every shipped rule belongs to an R-id)
//                                                                                             HFS_RULE_UNCATALOGUED
//   - a row of the rule table in knowledge/hfs/README.md section 12 whose id, code or law differs from the catalog, a
//     catalog rule the table lacks, or a typed rule range ("R01 to Rnn") that is not the catalog's  HFS_RULE_LAW_DRIFT
//   - an existing enforcer without a proof: an eslint rule whose law test file has no `.run("<id>"` block with both
//     `valid:` and `invalid:` cases, or a machine / hfs enforcer none of whose codes is named by two `test(` blocks of
//     one tests/*.spec.mjs (a violating and a passing tree)                                    HFS_RULE_UNTESTED
//   - a failure code with no entry in modules/kernel/failure-codes.yaml, or an entry lacking a Vietnamese
//     title_vi, meaning_vi or nextStep_vi                                                     HFS_RULE_CODE_UNCATALOGUED
//   - one obligation, one rule system (RED20): an `HFS_*`, `BE_*`, `FE_*` or `ARCH_*` code that a knowledge file
//     (knowledge/patterns/**, architecture-rules.yaml, modules/models/code-patterns.yaml)
//     names though it is neither a code of the catalog nor a key of failure-codes.yaml; the finding names the file
//                                                                                             HFS_RULE_CODE_UNCATALOGUED
//   - a code the architecture machine (ARCHITECTURE_RULE_IDS) or `hfs check` (CHECK_CODES, ALL_CHECK_CODES) can emit that no
//     rule lists in failureCodes; a code no rule owns has no R-id, no gate and no parity proof. The only exempt codes are the
//     infrastructure refusals ("cannot judge"), which their owners export as one list each (ERROR_RULE_IDS of the machine's
//     index, REFUSAL_CODES of scripts/lib/hfs-check.mjs)                                     HFS_RULE_CODE_UNOWNED
//   - a `status: planned` enforcer: the catalog carries no owed work (owner acceptance 2026-09-30)  HFS_RULE_ENFORCER_PLANNED
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { ALL_CHECK_CODES, REFUSAL_CODES } from '../lib/hfs-check.mjs';
import { HfsSlotsError, loadRuleCatalog, loadSlotManifest } from '../lib/hfs-slots.mjs';
import { ARCHITECTURE_RULE_IDS, ERROR_RULE_IDS } from './architecture/index.mjs';
import { isMain } from './common.mjs';

export const FAILURE_CODES_FILE = 'modules/kernel/failure-codes.yaml';
export const RULES_README = 'knowledge/hfs/README.md';
/** The files each check family's findings come from: a code spelled as a string literal in one of them is emitted. */
export const EMITTER_ROOTS = Object.freeze({
  machine: ['scripts/checks/architecture.mjs', 'scripts/checks/architecture'],
  hfs: ['scripts/lib/hfs-check.mjs', 'scripts/lib/hfs-rules', 'scripts/lib/hfs-slots.mjs', 'packages/hfs/bin', 'packages/hfs/sync'],
  'work-validate': ['scripts/checks/work-validate.mjs', 'scripts/checks/check-example-work.mjs', 'scripts/checks/check-work-artifacts.mjs'],
});
/** The knowledge files whose rule codes must belong to the one catalog (a directory is read recursively; a missing entry is skipped). */
export const KNOWLEDGE_CODE_ROOTS = Object.freeze(['knowledge/patterns', 'knowledge/architecture-rules.yaml', 'modules/models/code-patterns.yaml']);
const RULE_CODE = /\b(?:HFS|BE|FE|ARCH)_[A-Z0-9]+(?:_[A-Z0-9]+)*\b/g;
export const PLUGIN_ENTRY = Object.freeze({ 'eslint-be': 'packages/eslint/be/index.mjs', 'eslint-fe': 'packages/eslint/fe/index.mjs', stylelint: 'packages/stylelint/index.mjs' });
/** The stylelint canon's "why" map: the finding code of each rule. */
export const STYLELINT_WHY = 'packages/stylelint/lib/why.mjs';
const LINT_PLUGINS = Object.keys(PLUGIN_ENTRY);
const LINT_FAMILY = ['eslint-be', 'eslint-fe', 'stylelint'];
const CHECK_FAMILY = ['machine', 'hfs', 'work-validate'];
// A check spells its code as a string literal ('CODE') or as the `[CODE]` tail of a finding line.
const quoted = (code) => new RegExp(`['"\`]${code}['"\`]|\\[${code}\\]`);

/** The emitter files of every family under `root`, as {family: [{rel, text}]}. */
export function readEmitters(root) {
  const out = {};
  const walk = (rel) => {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return [];
    if (fs.statSync(abs).isFile()) return rel.endsWith('.mjs') ? [{ rel, text: fs.readFileSync(abs, 'utf8') }] : [];
    return fs.readdirSync(abs).sort().flatMap((name) => walk(`${rel}/${name}`));
  };
  // The machine's index lists every rule id it covers (coverage.checkedRuleIds) without emitting any of them.
  for (const [family, roots] of Object.entries(EMITTER_ROOTS)) out[family] = roots.flatMap(walk).filter((f) => f.rel !== 'scripts/checks/architecture/index.mjs');
  return out;
}

/** The test sources that prove the enforcers: {'eslint-be': text, 'eslint-fe': text, stylelint: [text], specs: [text]}. */
export function readTests(root) {
  const texts = (dir, re) => (fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter((f) => re.test(f)).sort().map((f) => fs.readFileSync(path.join(root, dir, f), 'utf8')) : []);
  return { 'eslint-be': texts('packages/eslint/be', /\.test\.mjs$/).join('\n'), 'eslint-fe': texts('packages/eslint/fe', /\.test\.mjs$/).join('\n'), stylelint: texts('packages/stylelint', /\.test\.mjs$/), specs: texts('tests', /\.spec\.mjs$/) };
}

/** True when a RuleTester run of `id` carries both valid and invalid cases. */
const lintProven = (text, id) => {
  for (const m of String(text).matchAll(/\.run\(\s*(['"`])([a-z0-9-]+)\1/g)) {
    if (m[2] !== id) continue;
    const rest = text.slice(m.index + m[0].length);
    const next = rest.search(/\.run\(\s*['"`]/);
    const block = next === -1 ? rest : rest.slice(0, next);
    if (/\bvalid\s*:/.test(block) && /\binvalid\s*:\s*\[\s*[^\]\s]/.test(block)) return true;
  }
  return false;
};

/**
 * True when a stylelint test file that lints the rule (`lintRule("<id>"`) has a test asserting no warning (an empty list or a
 * zero length) and a test asserting a warning (a non-zero length, a matched message or a listed one).
 */
const NO_WARNING = /\.deepEqual\([^\n]*,\s*\[\]\s*\)|\.equal\([^\n]*\.length,\s*0\s*\)/;
const A_WARNING = /\.equal\([^\n]*\.length,\s*[1-9]|\.match\(|\.deepEqual\([^\n]*\.map\(|\.ok\([^\n]*\.(?:some|length)/;
const stylelintProven = (files, id) => files.some((text) => {
  if (!new RegExp(`\\blintRule\\(\\s*(['"\`])${id}\\1`).test(text)) return false;
  const blocks = text.split(/\btest\(/).slice(1);
  return blocks.some((block) => NO_WARNING.test(block)) && blocks.some((block) => A_WARNING.test(block));
});

/** True when one spec names `code` in two separate test blocks (a finding tree and a clean tree). */
const specProven = (specs, code) => specs.some((text) => {
  // A spec may bind the code once (`const hits = (report) => findings(report, 'CODE')`) and use that name in its tests.
  // A top-level declaration runs until the next top-level `const`/`test(`/`function` line.
  const declarations = [...text.matchAll(/^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=([\s\S]*?)(?=^(?:export\s+)?(?:const|test\(|function|async function)\b|$(?![\s\S]))/gm)];
  const names = [code, ...declarations.filter((m) => m[2].includes(code)).map((m) => m[1])];
  return text.split(/\btest\(/).slice(1).filter((block) => names.some((name) => new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`).test(block))).length >= 2;
});

/** The knowledge files under `root` that may name a rule code, as [{rel, text}] (YAML only). */
export function readKnowledgeFiles(root) {
  const walk = (rel) => {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return [];
    if (fs.statSync(abs).isFile()) return rel.endsWith('.yaml') ? [{ rel, text: fs.readFileSync(abs, 'utf8') }] : [];
    return fs.readdirSync(abs).sort().flatMap((name) => walk(`${rel}/${name}`));
  };
  return KNOWLEDGE_CODE_ROOTS.flatMap(walk);
}

/** The README rule table: [{id, code, law}] from the rows `| Rnn | \`CODE\` | law |`. */
export function readmeRuleRows(text) {
  return [...String(text).matchAll(/^\| (R\d{2}) \| `([A-Z0-9_]+)` \| (.*) \|$/gm)].map((m) => ({ id: m[1], code: m[2], law: m[3] }));
}
/** A Vietnamese text carries at least one letter no other language of this repository uses. */
const VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/**
 * The rules of the stylelint canon, read from the package's source text: its peer dependencies (stylelint, postcss) are
 * installed only inside packages/stylelint, so importing the entry would make this check depend on that install.
 * {ids, why} like an eslint plugin, or {error}.
 */
export function stylelintRuleIds(root) {
  try {
    const source = fs.readFileSync(path.join(root, PLUGIN_ENTRY.stylelint), 'utf8');
    const body = /export const rules = \{([\s\S]*?)\n\}/.exec(source)?.[1];
    if (body === undefined) return { error: `${PLUGIN_ENTRY.stylelint} exports no rules` };
    const ids = new Set([...body.matchAll(/^\s*"([a-z0-9-]+)"\s*:/gm)].map((m) => m[1]));
    const reported = fs.readFileSync(path.join(root, STYLELINT_WHY), 'utf8');
    const why = new Map([...reported.matchAll(/^ {2}"([a-z0-9-]+)":\s*\{\s*code:\s*"([A-Z0-9_]+)"/gm)].map((m) => [m[1], m[2]]));
    return { ids, why };
  } catch (error) {
    return { error: `${PLUGIN_ENTRY.stylelint} cannot be read (${String(error?.message ?? error).split('\n')[0]})` };
  }
}

/** The rule ids of one eslint plugin package under `root`, or {error} when it cannot be loaded. */
export async function pluginRuleIds(root, kind) {
  const entry = PLUGIN_ENTRY[kind];
  if (kind === 'stylelint') return stylelintRuleIds(root);
  try {
    const loaded = await import(pathToFileURL(path.join(root, entry)).href);
    const rules = loaded.default?.rules ?? loaded.rules;
    if (!rules || typeof rules !== 'object') return { error: `${entry} exports no rules` };
    // A plugin may publish, per rule, the catalog code it reports under (`why[rule].code`); that is how a sub-code is emitted.
    const why = new Map(Object.entries(loaded.why ?? {}).filter(([, v]) => typeof v?.code === 'string').map(([id, v]) => [id, v.code]));
    return { ids: new Set(Object.keys(rules)), why };
  } catch (error) {
    return { error: `${entry} cannot be loaded (${String(error?.message ?? error).split('\n')[0]})` };
  }
}

/**
 * The findings of a catalog: [{code, rule, enforcer?, message}].
 * plugins: {'eslint-be': {ids: Set} | {error}, 'eslint-fe': ...}; failureCodes: the parsed catalog; files: {exists(rel), read(rel)};
 * codes: {machine, hfs, refusals}, every code the architecture machine and `hfs check` can emit and the refusal codes among them.
 */
export function hfsRulesFindings({ catalog, plugins, failureCodes, files, emitters, readme, tests, knowledge, codes }) {
  const findings = [];
  const add = (code, rule, message, enforcer) => findings.push({ code, rule, ...(enforcer ? { enforcer } : {}), message });
  for (const rule of catalog.rules) {
    if (!rule.enforcers.length) add('HFS_RULE_NO_ENFORCER', rule.id, `${rule.id} (${rule.code}) has no enforcer`);
    // Owner acceptance 2026-09-30: every rule ships at error on the day the canon ships; an owed enforcer is a gap, not a plan.
    for (const e of rule.enforcers) if (e.planned) add('HFS_RULE_ENFORCER_PLANNED', rule.id, `${rule.id} lists ${e.kind}:${e.id} as planned: build it (with a violating and a passing test) or delete it; the catalog carries no owed enforcer`, `${e.kind}:${e.id}`);
    for (const [kind, family, what] of [['lint', LINT_FAMILY, 'an eslint or stylelint rule'], ['check', CHECK_FAMILY, 'a machine, hfs or work-validate check']]) {
      if (rule.kinds.includes(kind) && !rule.enforcers.some((e) => family.includes(e.kind))) add('HFS_RULE_NO_ENFORCER', rule.id, `${rule.id} (${rule.code}) is kind ${kind} but names no ${what}`);
    }
    for (const enforcer of rule.enforcers) {
      const label = `${enforcer.kind}:${enforcer.id}`;
      if (LINT_FAMILY.includes(enforcer.kind)) {
        const plugin = plugins[enforcer.kind];
        if (plugin?.ids === undefined) {
          if (!enforcer.planned) add('HFS_RULE_ENFORCER_MISSING', rule.id, `${rule.id} names ${label} but ${plugin?.error ?? 'the plugin was not loaded'}`, label);
        } else if (enforcer.planned && plugin.ids.has(enforcer.id)) add('HFS_RULE_ENFORCER_STALE', rule.id, `${rule.id} lists ${label} as planned but the plugin already ships it; remove its status`, label);
        else if (!enforcer.planned && !plugin.ids.has(enforcer.id)) add('HFS_RULE_ENFORCER_MISSING', rule.id, `${rule.id} names ${label}, which is not a rule of ${PLUGIN_ENTRY[enforcer.kind]}`, label);
      } else if (!enforcer.planned && enforcer.at !== undefined) {
        if (!files.exists(enforcer.at)) add('HFS_RULE_ENFORCER_MISSING', rule.id, `${rule.id} names ${label} at ${enforcer.at}, which does not exist`, label);
        else if (!rule.failureCodes.some((c) => files.read(enforcer.at).includes(c))) add('HFS_RULE_ENFORCER_MISSING', rule.id, `${rule.id} names ${label} at ${enforcer.at}, but that file emits none of ${rule.failureCodes.join(', ')}`, label);
      }
    }
    const lintBuilt = rule.enforcers.some((e) => LINT_FAMILY.includes(e.kind) && !e.planned);
    const lintCodes = new Set(rule.enforcers.filter((e) => !e.planned && plugins[e.kind]?.why?.has(e.id)).map((e) => plugins[e.kind].why.get(e.id)));
    for (const e of rule.enforcers) {
      const code = !e.planned && plugins[e.kind]?.why?.get(e.id);
      if (code && !rule.failureCodes.includes(code)) add('HFS_RULE_UNCATALOGUED', rule.id, `${e.kind}:${e.id} reports under ${code}, which ${rule.id} does not list in failureCodes`, `${e.kind}:${e.id}`);
    }
    const builtAt = new Set(rule.enforcers.filter((e) => !e.planned && e.at).map((e) => e.at));
    const anyPlanned = rule.enforcers.some((e) => e.planned);
    const emittedBy = (code, families = CHECK_FAMILY) => families.flatMap((family) => (emitters?.[family] ?? []).filter((f) => quoted(code).test(f.text)).map((f) => f.rel));
    for (const enforcer of rule.enforcers) {
      if (!enforcer.planned || !CHECK_FAMILY.includes(enforcer.kind) || emitters === undefined) continue;
      // A file another built enforcer of this rule already names is that enforcer's emission, not this one's.
      const shipped = rule.failureCodes.flatMap((code) => emittedBy(code, [enforcer.kind])).filter((rel) => !builtAt.has(rel));
      if (shipped.length) add('HFS_RULE_ENFORCER_STALE', rule.id, `${rule.id} lists ${enforcer.kind}:${enforcer.id} as planned but ${shipped[0]} already emits its code; remove its status and name that file as \`at\``, `${enforcer.kind}:${enforcer.id}`);
    }
    if (emitters !== undefined && !anyPlanned) {
      for (const code of rule.failureCodes) {
        if ((code === rule.code && lintBuilt) || lintCodes.has(code) || emittedBy(code).length) continue;
        add('HFS_RULE_CODE_UNEMITTED', rule.id, `${rule.id} claims every enforcer is built, but no enforcer emits ${code}: no eslint or stylelint rule reports the rule's own code and no check file spells it`);
      }
    }
    if (tests !== undefined) for (const e of rule.enforcers) {
      if (e.planned) continue;
      if (e.kind === 'stylelint') {
        if (!stylelintProven(tests.stylelint ?? [], e.id)) add('HFS_RULE_UNTESTED', rule.id, `${e.kind}:${e.id} has no packages/stylelint/*.test.mjs that lints it (lintRule("${e.id}") with a test asserting no warning and a test asserting one`, `${e.kind}:${e.id}`);
      } else if (LINT_FAMILY.includes(e.kind)) {
        if (!lintProven(tests[e.kind], e.id)) add('HFS_RULE_UNTESTED', rule.id, `${e.kind}:${e.id} has no RuleTester run with both valid and invalid cases in packages/eslint/${e.kind.slice(7)}/*.test.mjs`, `${e.kind}:${e.id}`);
      } else if (CHECK_FAMILY.includes(e.kind) && !rule.failureCodes.some((code) => specProven(tests.specs, code))) {
        add('HFS_RULE_UNTESTED', rule.id, `${e.kind}:${e.id} has no tests/*.spec.mjs naming one of ${rule.failureCodes.join(', ')} in a violating and a passing test`, `${e.kind}:${e.id}`);
      }
    }
    for (const failureCode of rule.failureCodes) {
      const entry = failureCodes?.[failureCode];
      if (!entry) { add('HFS_RULE_CODE_UNCATALOGUED', rule.id, `${rule.id} reports ${failureCode}, which has no entry in ${FAILURE_CODES_FILE}`); continue; }
      for (const field of ['title_vi', 'meaning_vi', 'nextStep_vi']) {
        const value = entry[field];
        if (typeof value !== 'string' || !value.trim()) add('HFS_RULE_CODE_UNCATALOGUED', rule.id, `${failureCode} (${rule.id}) has no ${field}`);
        else if (!VIETNAMESE.test(value)) add('HFS_RULE_CODE_UNCATALOGUED', rule.id, `${failureCode} (${rule.id}) has a ${field} that is not Vietnamese`);
      }
    }
  }
  for (const kind of Object.keys(PLUGIN_ENTRY)) {
    const ids = plugins[kind]?.ids;
    if (ids === undefined) continue;
    const named = new Set(catalog.rules.flatMap((r) => r.enforcers.filter((e) => e.kind === kind).map((e) => e.id)));
    for (const id of [...ids].sort()) if (!named.has(id)) add('HFS_RULE_UNCATALOGUED', '-', `${kind}:${id} ships in ${PLUGIN_ENTRY[kind]} but no rule of the catalog names it; give it an R-id enforcer entry or delete the rule`, `${kind}:${id}`);
  }
  if (readme !== undefined) {
    const rows = new Map(readmeRuleRows(readme).map((row) => [row.id, row]));
    for (const rule of catalog.rules) {
      const row = rows.get(rule.id);
      if (!row) add('HFS_RULE_LAW_DRIFT', rule.id, `${RULES_README} section 12 has no row for ${rule.id}`);
      else if (row.code !== rule.code || row.law !== rule.law) add('HFS_RULE_LAW_DRIFT', rule.id, `${RULES_README} row ${rule.id} differs from the catalog: expected | ${rule.id} | \`${rule.code}\` | ${rule.law} |`);
      rows.delete(rule.id);
    }
    for (const id of rows.keys()) add('HFS_RULE_LAW_DRIFT', id, `${RULES_README} lists ${id}, which the catalog does not have`);
    const last = catalog.rules.at(-1).id;
    for (const m of String(readme).matchAll(/\bR01(?: to |-)(R\d{2})\b/g)) if (m[1] !== last) add('HFS_RULE_LAW_DRIFT', '-', `${RULES_README} states the range R01 to ${m[1]}, but the catalog ends at ${last}`);
  }
  if (codes !== undefined) {
    // RED19: every emitted code belongs to exactly one rule; only an infrastructure refusal ("cannot judge") is owned by none.
    const owned = new Set(catalog.rules.flatMap((r) => [r.code, ...r.failureCodes]));
    const refusals = new Set(codes.refusals ?? []);
    const reported = new Set();
    for (const [source, list] of Object.entries({ machine: codes.machine ?? [], hfs: codes.hfs ?? [] })) {
      for (const code of [...new Set(list)].sort()) {
        if (owned.has(code) || refusals.has(code) || reported.has(code)) continue;
        reported.add(code);
        add('HFS_RULE_CODE_UNOWNED', '-', `${code} can be emitted by the ${source} check but no rule of knowledge/hfs/rules.yaml lists it in failureCodes; list it under the one rule whose law it serves, or delete it. Only an infrastructure refusal ("cannot judge") is exempt, and its owner exports it in ERROR_RULE_IDS (architecture machine) or REFUSAL_CODES (hfs check)`);
      }
    }
  }
  if (knowledge !== undefined) {
    // RED20: a knowledge file states an obligation under the catalog's code or the failure catalog's, never under a third name.
    const known = new Set([...catalog.rules.flatMap((r) => [r.code, ...r.failureCodes]), ...Object.keys(failureCodes ?? {})]);
    for (const file of knowledge) {
      for (const code of new Set(String(file.text).match(RULE_CODE) ?? [])) {
        if (!known.has(code)) add('HFS_RULE_CODE_UNCATALOGUED', '-', `${file.rel} names ${code}, which is neither a code of knowledge/hfs/rules.yaml nor a key of ${FAILURE_CODES_FILE}; name the catalog code of the rule that judges it or delete the sentence`);
      }
    }
  }
  return findings;
}

/** Run the whole check against the runtime at `root`: {catalog, findings} or {refusal} when the catalog is refused. */
export async function checkHfsRules(root = skillRoot) {
  let catalog;
  try { catalog = loadRuleCatalog({ root, manifest: loadSlotManifest({ root }) }); } catch (error) {
    if (error instanceof HfsSlotsError) return { refusal: { code: error.code, message: error.message } };
    throw error;
  }
  const plugins = Object.fromEntries(await Promise.all(LINT_PLUGINS.map(async (kind) => [kind, await pluginRuleIds(root, kind)])));
  const failureCodes = parseYaml(fs.readFileSync(path.join(root, FAILURE_CODES_FILE), 'utf8')) ?? {};
  const files = { exists: (rel) => fs.existsSync(path.join(root, rel)), read: (rel) => fs.readFileSync(path.join(root, rel), 'utf8') };
  const readme = fs.readFileSync(path.join(root, RULES_README), 'utf8');
  return { catalog, findings: hfsRulesFindings({ catalog, plugins, failureCodes, files, emitters: readEmitters(root), readme, tests: readTests(root), knowledge: readKnowledgeFiles(root),
    codes: { machine: ARCHITECTURE_RULE_IDS, hfs: ALL_CHECK_CODES, refusals: [...ERROR_RULE_IDS, ...REFUSAL_CODES] } }) };
}

if (isMain(import.meta.url)) {
  const result = await checkHfsRules();
  const json = process.argv.includes('--json');
  if (result.refusal) {
    if (json) console.log(JSON.stringify({ ok: false, refusal: result.refusal }, null, 2)); else console.error(result.refusal.message);
    process.exit(1);
  }
  const { catalog, findings } = result;
  const planned = catalog.planned();
  const unbuilt = catalog.unbuilt().map((r) => ({ rule: r.id, code: r.code, planned: r.enforcers.map((e) => `${e.kind}:${e.id}`) }));
  const enforcers = catalog.rules.reduce((n, r) => n + r.enforcers.length, 0);
  const ok = findings.length === 0;
  if (json) console.log(JSON.stringify({ ok, rules: catalog.rules.length, enforcers, planned: planned.length, unbuilt, findings }, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.rule}: ${f.message}`);
    if (process.argv.includes('--unbuilt')) for (const u of unbuilt) console.log(`${u.rule}\t${u.code}\t${u.planned.join(' ')}`);
    if (ok) console.log(`OK: ${catalog.rules.length} rules, ${enforcers - planned.length} of ${enforcers} enforcers built, ${planned.length} planned, ${unbuilt.length} rules with no built enforcer yet (${FAILURE_CODES_FILE} names every failure code).`);
  }
  process.exit(ok ? 0 : 1);
}
