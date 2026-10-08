#!/usr/bin/env node
// check-hfs-rules.mjs - holds knowledge/hfs/rules.yaml (the HFS rule catalog) to what exists, in both directions (part of
// `npm run check`).
//   starci runtime check --only hfs-rules -- [--json] [--unbuilt]
//
// The catalog is loaded through scripts/hfs/slots.mjs (loadRuleCatalog), which refuses a catalog that breaks its schema
// (HFS_RULES_INVALID). On top of that this check refuses:
//   - a rule with no enforcer, or a `lint`/`check` kind with no enforcer of that family        HFS_RULE_NO_ENFORCER
//   - an existing eslint-be / eslint-fe enforcer whose id is not a rule of the plugin in packages/eslint/{be,fe},
//     or an existing machine / hfs / work-validate / runtime / sonar enforcer whose file (`at`) is missing or emits none
//     of the rule's codes                                                                            HFS_RULE_ENFORCER_MISSING
//   - a `status: planned` enforcer that already ships: an eslint id the plugin has, or a machine / hfs /
//     work-validate enforcer whose rule code an emitter of that family already emits (drop the status, name `at`)
//                                                                                             HFS_RULE_ENFORCER_STALE
//   - a failure code no enforcer emits while the rule claims every enforcer is built: an eslint or stylelint enforcer
//     emits the rule's own code, a machine / hfs / work-validate emitter emits a code it spells as a string literal
//                                                                                             HFS_RULE_CODE_UNEMITTED
//   - a rule of the eslint plugins that no catalog enforcer names (every shipped rule belongs to an R-id)
//                                                                                             HFS_RULE_UNCATALOGUED
//   - an existing enforcer without a proof: an eslint rule whose law test file has no `.run("<id>"` block with both
//     `valid:` and `invalid:` cases, or a machine / hfs enforcer none of whose codes is named by two `test(` blocks of
//     one tests/*.spec.mjs (a violating and a passing tree)                                    HFS_RULE_UNTESTED
//   - a failure code with no entry in modules/kernel/failure-codes.yaml, or an entry lacking a Vietnamese
//     title_vi, meaning_vi or nextStep_vi                                                     HFS_RULE_CODE_UNCATALOGUED
//   - one obligation, one rule system (RED20): an `HFS_*`, `BE_*`, `FE_*` or `ARCH_*` code that a knowledge file
//     (knowledge/patterns/**, architecture-rules.yaml, modules/models/code-patterns.yaml)
//     names though it is neither a code of the catalog nor a key of failure-codes.yaml; the finding names the file
//                                                                                             HFS_RULE_CODE_UNCATALOGUED
//   - a code the architecture machine (ARCHITECTURE_RULE_IDS) or `starci app check` (CHECK_CODES, ALL_CHECK_CODES) can emit that no
//     rule lists in failureCodes; a code no rule owns has no R-id, no gate and no parity proof. The only exempt codes are the
//     infrastructure refusals ("cannot judge"), which their owners export as one list each (ERROR_RULE_IDS of the machine's
//     index, REFUSAL_CODES of scripts/hfs/check.mjs)                                     HFS_RULE_CODE_UNOWNED
//   - a `status: planned` enforcer: the catalog carries no owed work (owner acceptance 2026-09-30)  HFS_RULE_ENFORCER_PLANNED
import fs from 'node:fs';
import path from 'node:path';
import { byCodeUnit } from '../lib/list.mjs';
import { eachInOrder } from '../lib/in-order.mjs';
import { pathToFileURL } from 'node:url';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { ALL_CHECK_CODES, REFUSAL_CODES } from '../hfs/check.mjs';
import { INFRASTRUCTURE_CODES } from '../hfs/infrastructure-codes.mjs';
import { HfsSlotsError, loadRuleCatalog, loadSlotManifest } from '../hfs/slots.mjs';
import { ARCHITECTURE_RULE_IDS, ERROR_RULE_IDS } from '../hfs/architecture/index.mjs';
import { isMain } from '../lib/is-main.mjs'; import { walkFiles } from '../lib/walk.mjs';
import { hasSecondLanguage } from '../lib/language.mjs';

export const FAILURE_CODES_FILE = 'modules/kernel/failure-codes.yaml';
/** The files each check family's findings come from: a code spelled as a string literal in one of them is emitted. */
const EMITTER_ROOTS = Object.freeze({
  machine: ['scripts/hfs/architecture.mjs', 'scripts/hfs/architecture'],
  hfs: ['scripts/hfs/check.mjs', 'scripts/hfs/rules', 'scripts/hfs/slots.mjs', 'packages/hfs/src', 'packages/hfs/sync'],
  'work-validate': ['scripts/work/validate/work-validate.mjs', 'scripts/work/validate/check-example-work.mjs', 'scripts/work/validate/check-work-artifacts.mjs'],
  runtime: ['scripts/hfs/runtime-check.mjs', 'scripts/hfs/runtime-rules', 'scripts/checks/check-contract-cites.mjs', 'scripts/checks/check-example-coupling.mjs', 'scripts/checks/check-spec-budget.mjs', 'scripts/checks/check-doc-owner.mjs', 'scripts/checks/check-port-once.mjs', 'scripts/checks/check-default-once.mjs', 'scripts/checks/check-version-pin-once.mjs', 'scripts/checks/check-slot-id-shape.mjs', 'scripts/checks/check-undeclared-identifiers.mjs', 'scripts/checks/check-removed-vocabulary.mjs', 'scripts/hfs/sync-runtime.mjs', 'scripts/checks/check-cli-parity.mjs', 'scripts/checks/check-cli-only-entry.mjs', 'scripts/cli/gen-catalog.mjs'],
});
/** The knowledge files whose rule codes must belong to the one catalog (a directory is read recursively; a missing entry is skipped). */
export const KNOWLEDGE_CODE_ROOTS = Object.freeze(['knowledge/patterns', 'knowledge/architecture-rules.yaml', 'modules/models/code-patterns.yaml']);
const RULE_CODE = /\b(?:HFS|BE|FE|ARCH)_[A-Z0-9]+(?:_[A-Z0-9]+)*\b/g;
export const PLUGIN_ENTRY = Object.freeze({ 'eslint-be': 'packages/eslint/be/index.mjs', 'eslint-fe': 'packages/eslint/fe/index.mjs', stylelint: 'packages/stylelint/index.mjs' });
/** The stylelint canon's "why" map: the finding code of each rule. */
const STYLELINT_WHY = 'packages/stylelint/lib/why.mjs';
const LINT_PLUGINS = Object.keys(PLUGIN_ENTRY);
const LINT_FAMILY = ['eslint-be', 'eslint-fe', 'stylelint'];
const CHECK_FAMILY = ['machine', 'hfs', 'work-validate', 'runtime'];
// A check spells its code as a string literal ('CODE') or as the `[CODE]` tail of a finding line.
const quoted = (code) => new RegExp(`['"\`]${code}['"\`]|\\[${code}\\]`);

/** The emitter files of every family under `root`, as {family: [{rel, text}]}. */
function readEmitters(root) {
  const out = {};
  const walk = (rel) => {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) return [];
    if (fs.statSync(abs).isFile()) return rel.endsWith('.mjs') ? [{ rel, text: fs.readFileSync(abs, 'utf8') }] : [];
    return fs.readdirSync(abs).sort().flatMap((name) => walk(`${rel}/${name}`));
  };
  // The machine's index lists every rule id it covers (coverage.checkedRuleIds) without emitting any of them.
  for (const [family, roots] of Object.entries(EMITTER_ROOTS)) out[family] = roots.flatMap(walk).filter((f) => f.rel !== 'scripts/hfs/architecture/index.mjs');
  return out;
}

/** The test sources that prove the enforcers: {'eslint-be': text, 'eslint-fe': text, stylelint: [text], specs: [text]}. */
function readTests(root) {
  const texts = (dir, re) => (fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter((f) => re.test(f)).sort().map((f) => fs.readFileSync(path.join(root, dir, f), 'utf8')) : []);
  // Runtime specs are read at any depth: tests/<area>/<module>.spec.mjs is their layout (RT_SPEC_PLACEMENT).
  const specs = walkFiles(path.join(root, 'tests'), { sorted: true, filter: (name) => name.endsWith('.spec.mjs'), exclude: (name) => name === 'node_modules' || name === 'fixtures' }).map((file) => fs.readFileSync(file, 'utf8'));
  return { 'eslint-be': texts('packages/eslint/be', /\.spec\.mjs$/).join('\n'), 'eslint-fe': texts('packages/eslint/fe', /\.spec\.mjs$/).join('\n'), stylelint: texts('packages/stylelint', /\.spec\.mjs$/), specs };
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
const SPEC_DECLARATION_HEADER = String.raw`^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=`;
const SPEC_DECLARATION_BOUNDARY = String.raw`^(?:export\s+)?(?:const|test\(|(?:async )?function)\b`;
const DOLLAR_ESCAPE = String.raw`\$`;
const SPEC_DECLARATION = new RegExp(`${SPEC_DECLARATION_HEADER}([^]*?)(?=${SPEC_DECLARATION_BOUNDARY}|(?![^]))`, 'gm');
const stylelintProven = (files, id) => files.some((text) => {
  if (!new RegExp(`\\blintRule\\(\\s*(['"\`])${id}\\1`).test(text)) return false;
  const blocks = text.split(/\btest\(/).slice(1);
  return blocks.some((block) => NO_WARNING.test(block)) && blocks.some((block) => A_WARNING.test(block));
});

/** True when one spec names `code` in two separate test blocks (a finding tree and a clean tree). */
const specProven = (specs, code) => specs.some((text) => {
  // A spec may bind the code once (`const hits = (report) => findings(report, 'CODE')`) and use that name in its tests.
  // A top-level declaration runs until the next top-level `const`/`test(`/`function` line.
  const declarations = [...text.matchAll(SPEC_DECLARATION)];
  const names = [code, ...declarations.filter((m) => m[2].includes(code)).map((m) => m[1])];
  return text.split(/\btest\(/).slice(1).filter((block) => names.some((name) => new RegExp(String.raw`\b${name.replaceAll('$', DOLLAR_ESCAPE)}\b`).test(block))).length >= 2;
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

/**
 * The rules of the stylelint canon, read from the package's source text: its peer dependencies (stylelint, postcss) are
 * installed only inside packages/stylelint, so importing the entry would make this check depend on that install.
 * {ids, why} like an eslint plugin, or {error}.
 */
const STYLELINT_RULE_LINE_START = String.raw`(?<=^|[\n\r\u2028\u2029])`;
const STYLELINT_RULE_ID = '[a-z0-9-]+';
const STYLELINT_RULE_PATTERN = String.raw`${STYLELINT_RULE_LINE_START}[^\S\n]*"(${STYLELINT_RULE_ID})"\s*:`;

export function stylelintRuleIds(root) {
  try {
    const source = fs.readFileSync(path.join(root, PLUGIN_ENTRY.stylelint), 'utf8');
    const body = /export const rules = \{([\s\S]*?)\n\}/.exec(source)?.[1];
    if (body === undefined) return { error: `${PLUGIN_ENTRY.stylelint} exports no rules` };
    const ids = new Set([...body.matchAll(new RegExp(STYLELINT_RULE_PATTERN, 'gm'))].map((m) => m[1]));
    const reported = fs.readFileSync(path.join(root, STYLELINT_WHY), 'utf8');
    const why = new Map([...reported.matchAll(/^ {2}"([a-z0-9-]+)":\s*\{\s*code:\s*"([A-Z0-9_]+)"/gm)].map((m) => [m[1], m[2]]));
    return { ids, why };
  } catch (error) {
    return { error: `${PLUGIN_ENTRY.stylelint} cannot be read (${String(error?.message ?? error).split('\n')[0]})` };
  }
}

/**
 * The `rules` binding of each `import { ... rules[ as <ident>] } from "./<file>"` of an eslint canon's entry, as
 * {ident -> file}: CONTRIBUTIONS gathers those bindings, so this maps the names the entry's rules are built from.
 */
const eslintRuleImports = (text) => {
  const map = new Map();
  for (const m of String(text).matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/([\w.-]+\.mjs)['"]/g)) {
    const binding = /\brules(?:\s+as\s+([A-Za-z_$][\w$]*))?/.exec(m[1]);
    if (binding) map.set(binding[1] ?? 'rules', m[2]);
  }
  return map;
};

/** The law files an eslint canon's entry gathers into its `rules` export: the CONTRIBUTIONS `rules:` bindings. */
const eslintContributionFiles = (text) => {
  const imported = eslintRuleImports(text);
  const block = /const CONTRIBUTIONS = \[([\s\S]*?)\n?\]/.exec(text)?.[1] ?? '';
  return [...new Set([...block.matchAll(/\brules:\s*([A-Za-z_$][\w$]*)/g)].map((m) => imported.get(m[1])).filter(Boolean))];
};

/**
 * The rule ids of one eslint plugin package under `root`, or {error} when it cannot be loaded. The entry itself is
 * not imported: its config module needs `@typescript-eslint/parser`, which installs only inside
 * packages/node_modules, and a checkout without that install (a land scratch gets a root npm ci alone) must still
 * judge the canon — the same reason the stylelint canon is read from source. The published ids are the keys of each
 * CONTRIBUTIONS member's `rules` export, so the law modules are imported directly: their own imports resolve without
 * the packages install (typescript sits in the root install, the `./runtime/` copies sync-runtime regenerates). The
 * per-rule catalog codes a plugin publishes (`why[id].code`, how a sub-code is emitted) live in its lib/why.mjs,
 * which the entry only re-exports.
 */
export async function pluginRuleIds(root, kind) {
  const entry = PLUGIN_ENTRY[kind];
  if (kind === 'stylelint') return stylelintRuleIds(root);
  try {
    const dir = path.dirname(path.join(root, entry));
    const files = eslintContributionFiles(fs.readFileSync(path.join(root, entry), 'utf8'));
    if (!files.length) return { error: `${entry} gathers no CONTRIBUTIONS the check can name` };
    const ids = new Set();
    await eachInOrder(files, async (file) => {
      const loaded = await import(pathToFileURL(path.join(dir, file)).href);
      if (!loaded.rules || typeof loaded.rules !== 'object') throw new Error(`${file} exports no rules`);
      for (const id of Object.keys(loaded.rules)) ids.add(id);
    });
    const whyFile = path.join(dir, 'lib', 'why.mjs');
    const whyModule = fs.existsSync(whyFile) ? await import(pathToFileURL(whyFile).href) : {};
    const why = new Map(Object.entries(whyModule.why ?? {}).filter(([, v]) => typeof v?.code === 'string').map(([id, v]) => [id, v.code]));
    return { ids, why };
  } catch (error) {
    return { error: `${entry} cannot be loaded (${String(error?.message ?? error).split('\n')[0]})` };
  }
}

/**
 * The findings of a catalog: [{code, rule, enforcer?, message}].
 * plugins: {'eslint-be': {ids: Set} | {error}, 'eslint-fe': ...}; failureCodes: the parsed catalog; files: {exists(rel), read(rel)};
 * codes: {machine, hfs, refusals}, every code the architecture machine and `starci app check` can emit and the refusal codes among them.
 */
/** The missing/stale/planned-enforcer findings of one rule's enforcer entries. */
const lintEnforcerFindings = (rule, enforcer, plugin, label, add) => {
  if (plugin?.ids === undefined) {
    if (!enforcer.planned) add('HFS_RULE_ENFORCER_MISSING', rule.id, `${rule.id} names ${label} but ${plugin?.error ?? 'the plugin was not loaded'}`, label);
    return;
  }
  if (enforcer.planned) {
    if (plugin.ids.has(enforcer.id)) add('HFS_RULE_ENFORCER_STALE', rule.id, `${rule.id} lists ${label} as planned but the plugin already ships it; remove its status`, label);
    return;
  }
  if (!plugin.ids.has(enforcer.id)) add('HFS_RULE_ENFORCER_MISSING', rule.id, `${rule.id} names ${label}, which is not a rule of ${PLUGIN_ENTRY[enforcer.kind]}`, label);
};

const machineEnforcerFindings = (rule, enforcer, label, files, add) => {
  if (enforcer.planned || enforcer.at === undefined) return;
  if (!files.exists(enforcer.at)) add('HFS_RULE_ENFORCER_MISSING', rule.id, `${rule.id} names ${label} at ${enforcer.at}, which does not exist`, label);
  else if (!rule.failureCodes.some((code) => files.read(enforcer.at).includes(code))) add('HFS_RULE_ENFORCER_MISSING', rule.id, `${rule.id} names ${label} at ${enforcer.at}, but that file emits none of ${rule.failureCodes.join(', ')}`, label);
};

const enforcerFindings = (rule, plugins, files, add) => {
  for (const enforcer of rule.enforcers) {
    const label = `${enforcer.kind}:${enforcer.id}`;
    if (LINT_FAMILY.includes(enforcer.kind)) lintEnforcerFindings(rule, enforcer, plugins[enforcer.kind], label, add);
    else machineEnforcerFindings(rule, enforcer, label, files, add);
  }
};

/** The uncatalogued-code, stale-planned and unemitted-code findings of one rule (the emission pass). */
const uncataloguedEnforcerFindings = (rule, plugins, add) => {
  for (const e of rule.enforcers) {
    const code = !e.planned && plugins[e.kind]?.why?.get(e.id);
    if (code && !rule.failureCodes.includes(code)) add('HFS_RULE_UNCATALOGUED', rule.id, `${e.kind}:${e.id} reports under ${code}, which ${rule.id} does not list in failureCodes`, `${e.kind}:${e.id}`);
  }
};

const plannedMachineEnforcerFindings = (rule, emitters, builtAt, emittedBy, add) => {
  for (const enforcer of rule.enforcers) {
    if (!enforcer.planned || !CHECK_FAMILY.includes(enforcer.kind) || emitters === undefined) continue;
    // A file another built enforcer of this rule already names is that enforcer's emission, not this one's.
    const shipped = rule.failureCodes.flatMap((code) => emittedBy(code, [enforcer.kind])).filter((rel) => !builtAt.has(rel));
    if (shipped.length) add('HFS_RULE_ENFORCER_STALE', rule.id, `${rule.id} lists ${enforcer.kind}:${enforcer.id} as planned but ${shipped[0]} already emits its code; remove its status and name that file as \`at\``, `${enforcer.kind}:${enforcer.id}`);
  }
};

const unemittedCodeFindings = (rule, lintBuilt, lintCodes, anyPlanned, emitters, emittedBy, add) => {
  if (emitters !== undefined && !anyPlanned) {
    for (const code of rule.failureCodes) {
      if ((code === rule.code && lintBuilt) || lintCodes.has(code) || emittedBy(code).length) continue;
      add('HFS_RULE_CODE_UNEMITTED', rule.id, `${rule.id} claims every enforcer is built, but no enforcer emits ${code}: no eslint or stylelint rule reports the rule's own code and no check file spells it`);
    }
  }
};

const emissionFindings = (rule, plugins, emitters, add) => {
  const lintBuilt = rule.enforcers.some((e) => LINT_FAMILY.includes(e.kind) && !e.planned);
  const lintCodes = new Set(rule.enforcers.filter((e) => !e.planned && plugins[e.kind]?.why?.has(e.id)).map((e) => plugins[e.kind].why.get(e.id)));
  uncataloguedEnforcerFindings(rule, plugins, add);
  const builtAt = new Set(rule.enforcers.filter((e) => !e.planned && e.at).map((e) => e.at));
  const anyPlanned = rule.enforcers.some((e) => e.planned);
  const emittedBy = (code, families = CHECK_FAMILY) => families.flatMap((family) => (emitters?.[family] ?? []).filter((f) => quoted(code).test(f.text)).map((f) => f.rel));
  plannedMachineEnforcerFindings(rule, emitters, builtAt, emittedBy, add);
  unemittedCodeFindings(rule, lintBuilt, lintCodes, anyPlanned, emitters, emittedBy, add);
};

/** The untested-enforcer findings of one rule (called only when test sources were read). */
const testedFindings = (rule, tests, add) => {
  for (const e of rule.enforcers) {
    if (e.planned) continue;
    if (e.kind === 'stylelint') {
      if (!stylelintProven(tests.stylelint ?? [], e.id)) add('HFS_RULE_UNTESTED', rule.id, `${e.kind}:${e.id} has no packages/stylelint/*.spec.mjs that lints it (lintRule("${e.id}") with a test asserting no warning and a test asserting one`, `${e.kind}:${e.id}`);
    } else if (LINT_FAMILY.includes(e.kind)) {
      if (!lintProven(tests[e.kind], e.id)) add('HFS_RULE_UNTESTED', rule.id, `${e.kind}:${e.id} has no RuleTester run with both valid and invalid cases in packages/eslint/${e.kind.slice(7)}/*.spec.mjs`, `${e.kind}:${e.id}`);
    } else if (CHECK_FAMILY.includes(e.kind) && !rule.failureCodes.some((code) => specProven(tests.specs, code))) {
      add('HFS_RULE_UNTESTED', rule.id, `${e.kind}:${e.id} has no tests/*.spec.mjs naming one of ${rule.failureCodes.join(', ')} in a violating and a passing test`, `${e.kind}:${e.id}`);
    }
  }
};

/** The failure-catalog findings of one rule's own codes (missing entry, missing or non-Vietnamese fields). */
const failureEntryFindings = (rule, failureCodes, add) => {
  for (const failureCode of rule.failureCodes) {
    const entry = failureCodes?.[failureCode];
    if (!entry) { add('HFS_RULE_CODE_UNCATALOGUED', rule.id, `${rule.id} reports ${failureCode}, which has no entry in ${FAILURE_CODES_FILE}`); continue; }
    for (const field of ['title_vi', 'meaning_vi', 'nextStep_vi']) {
      const value = entry[field];
      if (typeof value !== 'string' || !value.trim()) add('HFS_RULE_CODE_UNCATALOGUED', rule.id, `${failureCode} (${rule.id}) has no ${field}`);
      else if (!hasSecondLanguage(value)) add('HFS_RULE_CODE_UNCATALOGUED', rule.id, `${failureCode} (${rule.id}) has a ${field} that is not Vietnamese`);
    }
  }
};

/** Every finding of one catalog rule, in the order the passes below produce them. */
const ruleFindings = (rule, { plugins, files, emitters, tests, failureCodes }, add) => {
  if (!rule.enforcers.length) add('HFS_RULE_NO_ENFORCER', rule.id, `${rule.id} (${rule.code}) has no enforcer`);
  // Owner acceptance 2026-09-30: every rule ships at error on the day the canon ships; an owed enforcer is a gap, not a plan.
  for (const e of rule.enforcers) if (e.planned) add('HFS_RULE_ENFORCER_PLANNED', rule.id, `${rule.id} lists ${e.kind}:${e.id} as planned: build it (with a violating and a passing test) or delete it; the catalog carries no owed enforcer`, `${e.kind}:${e.id}`);
  for (const [kind, family, what] of [['lint', LINT_FAMILY, 'an eslint or stylelint rule'], ['check', CHECK_FAMILY, 'a machine, hfs, work-validate or runtime check']]) {
    if (rule.kinds.includes(kind) && !rule.enforcers.some((e) => family.includes(e.kind))) add('HFS_RULE_NO_ENFORCER', rule.id, `${rule.id} (${rule.code}) is kind ${kind} but names no ${what}`);
  }
  enforcerFindings(rule, plugins, files, add);
  emissionFindings(rule, plugins, emitters, add);
  if (tests !== undefined) testedFindings(rule, tests, add);
  failureEntryFindings(rule, failureCodes, add);
};

/** The shipped plugin rules no catalog rule names (HFS_RULE_UNCATALOGUED). */
const uncataloguedPluginFindings = (catalog, plugins, add) => {
  for (const kind of Object.keys(PLUGIN_ENTRY)) {
    const ids = plugins[kind]?.ids;
    if (ids === undefined) continue;
    const named = new Set(catalog.rules.flatMap((r) => r.enforcers.filter((e) => e.kind === kind).map((e) => e.id)));
    for (const id of [...ids].sort(byCodeUnit)) if (!named.has(id)) add('HFS_RULE_UNCATALOGUED', '-', `${kind}:${id} ships in ${PLUGIN_ENTRY[kind]} but no rule of the catalog names it; give it an R-id enforcer entry or delete the rule`, `${kind}:${id}`);
  }
};

/** The emitted codes no rule owns (RED19; skipped when `codes` was not supplied). */
const unownedCodeFindings = (catalog, codes, add) => {
  if (codes === undefined) return;
  // RED19: every emitted code belongs to exactly one rule; only an infrastructure refusal ("cannot judge") is owned by none.
  const owned = new Set(catalog.rules.flatMap((r) => [r.code, ...r.failureCodes]));
  const refusals = new Set(codes.refusals ?? []);
  const reported = new Set();
  for (const [source, list] of Object.entries({ machine: codes.machine ?? [], 'starci app': codes.hfs ?? [] })) {
    for (const code of [...new Set(list)].sort(byCodeUnit)) {
      if (owned.has(code) || refusals.has(code) || reported.has(code)) continue;
      reported.add(code);
      add('HFS_RULE_CODE_UNOWNED', '-', `${code} can be emitted by the ${source} check but no rule of knowledge/hfs/rules.yaml lists it in failureCodes; list it under the one rule whose law it serves, or delete it. Only an infrastructure refusal ("cannot judge") is exempt, and its owner exports it in ERROR_RULE_IDS (architecture machine) or REFUSAL_CODES (starci app check)`);
    }
  }
};

/** The catalog-code/infrastructure-code mismatches (S7-02; skipped when `infrastructure` was not supplied). */
const infrastructureFindings = (catalog, failureCodes, codes, infrastructure, add) => {
  if (infrastructure === undefined) return;
  // S7-02: every HFS_/BE_/FE_/ARCH_ code of the failure catalog is a code of a rule, a "cannot judge" refusal, or declared
  // infrastructure (the harness's own tools reporting about themselves, scripts/hfs/infrastructure-codes.mjs).
  const owned = new Set(catalog.rules.flatMap((r) => [r.code, ...r.failureCodes]));
  const exempt = new Set([...(codes?.refusals ?? []), ...Object.keys(infrastructure)]);
  for (const code of Object.keys(failureCodes ?? {}).filter((c) => /^(HFS|BE|FE|ARCH)_/.test(c)).sort(byCodeUnit)) {
    if (!owned.has(code) && !exempt.has(code)) add('HFS_RULE_CODE_UNOWNED', '-', `${code} is in ${FAILURE_CODES_FILE} but no rule of knowledge/hfs/rules.yaml lists it in failureCodes and it is not declared infrastructure (scripts/hfs/infrastructure-codes.mjs): list it under the one rule whose law it serves, declare it infrastructure with its emitter, or delete it`);
  }
  for (const code of Object.keys(infrastructure).sort(byCodeUnit)) {
    if (owned.has(code) || !Object.hasOwn(failureCodes ?? {}, code)) {
      const why = owned.has(code) ? 'a rule owns it' : `${FAILURE_CODES_FILE} has no entry for it`;
      add('HFS_RULE_CODE_UNOWNED', '-', `${code} is declared infrastructure but ${why}: delete it from scripts/hfs/infrastructure-codes.mjs`);
    }
  }
};

/** The rule codes a knowledge file names that are neither catalog codes nor failure codes (RED20). */
const knowledgeFindings = (catalog, failureCodes, knowledge, add) => {
  if (knowledge === undefined) return;
  // RED20: a knowledge file states an obligation under the catalog's code or the failure catalog's, never under a third name.
  const known = new Set([...catalog.rules.flatMap((r) => [r.code, ...r.failureCodes]), ...Object.keys(failureCodes ?? {})]);
  for (const file of knowledge) {
    for (const code of new Set(String(file.text).match(RULE_CODE) ?? [])) {
      if (!known.has(code)) add('HFS_RULE_CODE_UNCATALOGUED', '-', `${file.rel} names ${code}, which is neither a code of knowledge/hfs/rules.yaml nor a key of ${FAILURE_CODES_FILE}; name the catalog code of the rule that judges it or delete the sentence`);
    }
  }
};

export function hfsRulesFindings({ catalog, plugins, failureCodes, files, emitters, tests, knowledge, codes, infrastructure }) {
  const findings = [];
  const add = (code, rule, message, enforcer) => findings.push({ code, rule, ...(enforcer ? { enforcer } : {}), message });
  const context = { plugins, files, emitters, tests, failureCodes };
  for (const rule of catalog.rules) ruleFindings(rule, context, add);
  uncataloguedPluginFindings(catalog, plugins, add);
  unownedCodeFindings(catalog, codes, add);
  infrastructureFindings(catalog, failureCodes, codes, infrastructure, add);
  knowledgeFindings(catalog, failureCodes, knowledge, add);
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
  return { catalog, findings: hfsRulesFindings({ catalog, plugins, failureCodes, files, emitters: readEmitters(root), tests: readTests(root), knowledge: readKnowledgeFiles(root),
    codes: { machine: ARCHITECTURE_RULE_IDS, hfs: ALL_CHECK_CODES, refusals: [...ERROR_RULE_IDS, ...REFUSAL_CODES] }, infrastructure: INFRASTRUCTURE_CODES }) };
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
