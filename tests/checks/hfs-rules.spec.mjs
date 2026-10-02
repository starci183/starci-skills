import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';
import { HfsSlotsError, loadRuleCatalog, loadSlotManifest, openHfs, rules } from '../../scripts/hfs/slots.mjs';
import { hfsRulesFindings, pluginRuleIds, stylelintRuleIds, checkHfsRules, PLUGIN_ENTRY, readKnowledgeFiles, KNOWLEDGE_CODE_ROOTS } from '../../scripts/checks/check-hfs-rules.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const catalogText = fs.readFileSync(path.join(root, 'knowledge/hfs/rules.yaml'), 'utf8');
const schemaText = fs.readFileSync(path.join(root, 'modules/schemas/hfs-rules.schema.yaml'), 'utf8');

const Ajv2020 = (() => { const loaded = createRequire(import.meta.url)('ajv/dist/2020.js'); return loaded.default ?? loaded; })();
const validateSchema = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(schemaText));

const refusal = (fn, code) => assert.throws(fn, (error) => error instanceof HfsSlotsError && error.code === code, `expected ${code}`);
const doc = () => parseYaml(catalogText);
/** The catalog with R01 owing its only enforcer: what the loader and the check must recognise as work still to do. */
const withPlanned = (d) => { d.rules[0].enforcers = [{ kind: 'hfs', id: 'slot-undeclared', status: 'planned' }]; return d; };
const load = (mutate) => { const d = doc(); mutate(d); return () => loadRuleCatalog({ text: JSON.stringify(d) }); };

test('the shipped catalog is 2.0.0, validates against its JSON schema and loads with the slot manifest major', () => {
  const d = doc();
  assert.equal(d.version, '2.0.0');
  assert.equal(validateSchema(d), true, JSON.stringify(validateSchema.errors));
  const catalog = loadRuleCatalog({ manifest: loadSlotManifest() });
  assert.equal(catalog.major, 2);
  assert.deepEqual(catalog.rules.map((r) => r.id), [...catalog.rules.map((r) => r.id)].sort((x, y) => Number(x.slice(1)) - Number(y.slice(1))), 'ids increase; a retired rule leaves its id unused, so there may be gaps');
  assert.equal(new Set(catalog.rules.map((r) => r.id)).size, catalog.rules.length);
  for (const rule of catalog.rules) {
    assert.ok(rule.enforcers.length > 0, `${rule.id} has an enforcer`);
    assert.equal(rule.failureCodes[0], rule.code);
    assert.ok(rule.gates.includes('land'), `${rule.id} runs at land`);
  }
});

test('the loader answers by id, code, gate, enforcer and what is still owed', () => {
  const catalog = loadRuleCatalog();
  assert.equal(catalog.rule('R12').code, 'HFS_E2E_IN_AUTOMATIC_GATE');
  assert.equal(catalog.rule('R00'), null);
  assert.equal(catalog.rule('R101').code, 'BE_TEST_BUILDER_ARRANGES', 'a three-digit id is a rule id');
  assert.equal(catalog.byCode('FE_NEXT_CONVENTIONS').id, 'R54');
  assert.equal(catalog.byCode('HFS_SLOT_UNDECLARED').id, 'R01');
  assert.equal(catalog.byCode('NOT_A_CODE'), null);
  assert.deepEqual(catalog.forGate('sonar').map((r) => r.id), ['R20', 'R21']);
  assert.deepEqual(catalog.forGate('pre-commit').map((r) => r.id).filter((id) => ['R06', 'R18', 'R62'].includes(id)), ['R06', 'R18', 'R62']);
  assert.deepEqual(catalog.forEnforcer('eslint-be', 'error-home').map((r) => r.id), ['R38']);
  assert.deepEqual(catalog.forEnforcer('eslint-fe', 'no-inline-lint-config').map((r) => r.id), ['R18']);
  assert.equal(catalog.lintCode('starci-be/error-home'), 'BE_ERROR_HOME');
  assert.equal(catalog.lintCode('starci-fe/no-inline-lint-config'), 'HFS_INLINE_SUPPRESSION');
  assert.equal(catalog.lintCode('starci-be/no-such-rule'), undefined);
  assert.equal(catalog.lintCode('other/error-home'), undefined);
  const owed = loadRuleCatalog({ text: JSON.stringify(withPlanned(doc())) });
  assert.deepEqual(owed.unbuilt().map((r) => r.id).slice(0, 1), ['R01'], 'a rule whose only enforcer is planned is unbuilt');
  assert.ok(owed.planned().some((p) => p.rule === 'R01' && p.kind === 'hfs' && p.id === 'slot-undeclared'));
  const unbuilt = catalog.unbuilt().map((r) => r.id);
  assert.ok(!unbuilt.includes('R12'), 'R12 is enforced by the architecture machine today');
  assert.ok(!unbuilt.includes('R58'), 'R58 is enforced by eslint-fe');
  assert.ok(catalog.planned().every((p) => p.rule && p.kind && p.id));
  assert.deepEqual(Object.keys(catalog.gates), ['pre-commit', 'pre-push', 'settle', 'land', 'ci', 'sonar', 'runtime']);
});

test('rules() and openHfs().rules() give the same frozen catalog', () => {
  const list = rules();
  assert.equal(list.length, loadRuleCatalog().rules.length);
  assert.ok(Object.isFrozen(list) && Object.isFrozen(list[0]) && Object.isFrozen(list[0].enforcers));
  const app = { hfs: 2, kind: 'app', project: 'nivo', sides: {
    be: { apps: [{ name: 'core', kind: 'api' }, { name: 'worker', kind: 'worker' }, { name: 'cli', kind: 'cli' }], optionalSlots: ['be.contract.graphql', 'repo.docs'], connections: [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'database' }, { name: 'agentos', envPrefix: 'AGENTOS_DB', owner: 'core', isolation: 'database' }] },
    fe: { apps: [{ name: 'web', kind: 'next' }], reads: ['be/contracts/'] },
  } };
  assert.equal(openHfs({ declaration: app }).rules().rules.length, list.length);
});

test('schema and loader agree on a broken catalog', () => {
  const cases = {
    'rule without an enforcer': (d) => { d.rules[0].enforcers = []; },
    'unknown enforcer kind': (d) => { d.rules[0].enforcers[0].kind = 'prettier'; },
    'unknown gate': (d) => { d.rules[0].gates = ['land', 'nightly']; },
    'unknown fix kind': (d) => { d.rules[0].kinds = ['rewrite']; },
    'code not upper snake': (d) => { d.rules[0].code = 'slotUndeclared'; },
    'missing law': (d) => { delete d.rules[0].law; },
    'unknown rule field': (d) => { d.rules[0].severity = 'warn'; },
    'planned status spelled wrongly': (d) => { d.rules[0].enforcers[0].status = 'todo'; },
    'version not semver': (d) => { d.version = '2.0'; },
    'id with one digit': (d) => { d.rules[0].id = 'R1'; },
    'id with four digits': (d) => { d.rules[0].id = 'R1000'; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const broken = doc();
    mutate(broken);
    assert.equal(validateSchema(broken), false, `schema accepted: ${name}`);
    refusal(load(mutate), 'HFS_RULES_INVALID');
  }
});

test('the loader also refuses what only semantics can see', () => {
  refusal(load((d) => { d.rules[1].id = 'R01'; }), 'HFS_RULES_INVALID');   // ids only increase: a repeat or a step back is refused
  assert.doesNotThrow(load((d) => { d.rules[0].id = 'R99'; d.rules[1].id = 'R100'; d.rules.length = 2; }));   // ids compare as numbers: R100 follows R99
  refusal(load((d) => { d.rules[0].id = 'R100'; d.rules[1].id = 'R99'; d.rules.length = 2; }), 'HFS_RULES_INVALID');
  assert.doesNotThrow(load((d) => { d.rules.splice(1, 1); }));             // a retired rule leaves a gap in the ids, which is fine
  refusal(load((d) => { d.rules[1].failureCodes = [d.rules[1].code, d.rules[0].code]; }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.rules[0].failureCodes = ['HFS_SOMETHING_ELSE']; }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.rules[0].gates = ['pre-push', 'settle']; }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.rules[5].gates = ['pre-commit', 'land', 'ci']; }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.rules[0].gates.push('sonar'); }), 'HFS_RULES_INVALID');
  const owing = (mutate) => load((d) => { withPlanned(d); mutate(d); });
  refusal(owing((d) => { d.rules[0].enforcers[0].at = 'scripts/x.mjs'; }), 'HFS_RULES_INVALID');
  refusal(owing((d) => { d.rules[0].enforcers[0].status = undefined; }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.rules[0].enforcers.push({ ...d.rules[0].enforcers[0] }); }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.rules[0].law = 'one\ntwo'; }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.schema = 'starci/hfs-rules@3'; }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.gates = { land: 'x' }; }), 'HFS_RULES_INVALID');
  refusal(() => loadRuleCatalog({ text: '{ not: [valid' }), 'HFS_RULES_INVALID');
});

test('a catalog whose major differs from the slot manifest is refused', () => {
  const d = doc();
  d.version = '3.0.0';
  d.schema = 'starci/hfs-rules@3';
  refusal(() => loadRuleCatalog({ text: JSON.stringify(d), manifest: loadSlotManifest() }), 'HFS_MANIFEST_MAJOR_MISMATCH');
});

// ------------------------------------------------------------------------------------------------ the check

const codeEntry = { title_vi: 'Ti\u00eau \u0111\u1ec1', meaning_vi: '\u00dd ngh\u0129a c\u1ee7a l\u1ed7i', nextStep_vi: 'B\u01b0\u1edbc ti\u1ebfp theo' };
const failureCatalog = (catalog, without = []) => Object.fromEntries(catalog.rules.flatMap((r) => r.failureCodes).filter((c) => !without.includes(c)).map((c) => [c, { ...codeEntry }]));
// The real enforcer files of this runtime: every `at` exists and emits its rule's codes (the check itself proves it).
const allFiles = { exists: (rel) => fs.existsSync(path.join(root, rel)), read: (rel) => fs.readFileSync(path.join(root, rel), 'utf8') };
const pluginsOf = (catalog) => {
  const ids = (kind) => new Set(catalog.rules.flatMap((r) => r.enforcers).filter((e) => e.kind === kind && !e.planned).map((e) => e.id));
  return { 'eslint-be': { ids: ids('eslint-be') }, 'eslint-fe': { ids: ids('eslint-fe') }, stylelint: { ids: ids('stylelint') } };
};
const run = (catalog, over = {}) => hfsRulesFindings({ catalog, plugins: pluginsOf(catalog), failureCodes: failureCatalog(catalog), files: allFiles, ...over });

test('a catalog whose eslint ids, files and codes all exist has no finding', () => {
  const catalog = loadRuleCatalog();
  assert.deepEqual(run(catalog), []);
});

test('an eslint enforcer the plugin does not ship is a finding, and so is a plugin that cannot load', () => {
  const catalog = loadRuleCatalog();
  const plugins = pluginsOf(catalog);
  plugins['eslint-be'].ids.delete('error-home');
  const findings = run(catalog, { plugins });
  assert.deepEqual(findings.map((f) => [f.code, f.rule, f.enforcer]), [['HFS_RULE_ENFORCER_MISSING', 'R38', 'eslint-be:error-home']]);
  const broken = run(catalog, { plugins: { ...pluginsOf(catalog), 'eslint-fe': { error: 'packages/eslint/fe/index.mjs cannot be loaded (boom)' } } });
  assert.ok(broken.length > 0 && broken.every((f) => f.code === 'HFS_RULE_ENFORCER_MISSING' && f.enforcer.startsWith('eslint-fe:')));
});

test('a planned eslint enforcer the plugin already ships is stale', () => {
  const base = loadRuleCatalog();
  const plugins = pluginsOf(base);
  // mark a shipped eslint enforcer planned again: the plugin still ships it, so the status is stale
  const catalog = { ...base, rules: base.rules.map((r) => (r.id === 'R38' ? { ...r, enforcers: r.enforcers.map((e) => (e.kind === 'eslint-be' && e.id === 'error-home' ? { ...e, planned: true } : e)) } : r)) };
  const findings = run(catalog, { plugins });
  assert.deepEqual(findings.map((f) => [f.code, f.rule, f.enforcer]), [['HFS_RULE_ENFORCER_PLANNED', 'R38', 'eslint-be:error-home'], ['HFS_RULE_ENFORCER_STALE', 'R38', 'eslint-be:error-home']]);
});

test('an existing machine enforcer needs its file to exist and to emit the rule code', () => {
  const catalog = loadRuleCatalog();
  const missing = run(catalog, { files: { exists: (rel) => rel !== 'scripts/hfs/architecture/hfs.mjs', read: allFiles.read } });
  assert.deepEqual(missing.map((f) => [f.code, f.rule]), catalog.rules.filter((r) => r.enforcers.some((e) => !e.planned && e.at === 'scripts/hfs/architecture/hfs.mjs')).map((r) => ['HFS_RULE_ENFORCER_MISSING', r.id]));
  const silent = run(catalog, { files: { exists: () => true, read: () => 'nothing here' } });
  assert.ok(silent.length >= 3 && silent.every((f) => f.code === 'HFS_RULE_ENFORCER_MISSING'));
});

test('a rule with no enforcer, or a lint kind with no lint enforcer, is a finding', () => {
  const catalog = loadRuleCatalog();
  const bare = { ...catalog, rules: catalog.rules.map((r) => (r.id === 'R01' ? { ...r, enforcers: [] } : r.id === 'R06' ? { ...r, kinds: ['lint'] } : r)) };
  const findings = run(bare);
  assert.deepEqual(findings.map((f) => [f.code, f.rule]), [['HFS_RULE_NO_ENFORCER', 'R01'], ['HFS_RULE_NO_ENFORCER', 'R01'], ['HFS_RULE_NO_ENFORCER', 'R01'], ['HFS_RULE_NO_ENFORCER', 'R06']]);
});

test('a failure code with no catalog entry, or an entry that is not Vietnamese, is a finding', () => {
  const catalog = loadRuleCatalog();
  const gone = run(catalog, { failureCodes: failureCatalog(catalog, ['FE_NEXT_CONVENTIONS']) });
  assert.deepEqual(gone.map((f) => [f.code, f.rule]), [['HFS_RULE_CODE_UNCATALOGUED', 'R54']]);
  const english = failureCatalog(catalog);
  english.HFS_SLOT_UNDECLARED = { title_vi: 'Path matches no slot', meaning_vi: '\u0110\u01b0\u1eddng d\u1eabn kh\u00f4ng h\u1ee3p l\u1ec7', nextStep_vi: '' };
  const findings = run(catalog, { failureCodes: english });
  assert.deepEqual(findings.map((f) => f.message.includes('title_vi') || f.message.includes('nextStep_vi')), [true, true]);
  assert.ok(findings.every((f) => f.code === 'HFS_RULE_CODE_UNCATALOGUED' && f.rule === 'R01'));
});

test('a planned machine enforcer whose code a machine file already emits is stale, unless another built enforcer names that file', () => {
  const catalog = loadRuleCatalog();
  const r26 = catalog.rule('R02');
  const planned = { ...catalog, rules: [{ ...r26, enforcers: r26.enforcers.filter((e) => e.at === 'scripts/hfs/architecture/required-files.mjs').map((e) => ({ kind: e.kind, id: e.id, planned: true })) }] };
  const emitters = { machine: [{ rel: 'scripts/hfs/architecture/required-files.mjs', text: `ruleId: '${r26.code}'` }], hfs: [], 'work-validate': [] };
  const stale = run(planned, { emitters }).filter((f) => f.code === 'HFS_RULE_ENFORCER_STALE');
  assert.deepEqual(stale.map((f) => [f.code, f.rule]), [['HFS_RULE_ENFORCER_STALE', 'R02']]);
});

test('a rule that claims every enforcer is built but whose code nothing emits is unemitted', () => {
  const catalog = loadRuleCatalog();
  const emitters = { machine: [], hfs: [], 'work-validate': [] };
  const machineOnly = catalog.rules.filter((r) => r.enforcers.every((e) => !e.planned && ['machine', 'hfs', 'work-validate'].includes(e.kind)));
  assert.ok(machineOnly.length > 0);
  const findings = run(catalog, { emitters, files: { exists: () => true, read: () => machineOnly.flatMap((r) => r.failureCodes).join(' ') } });
  for (const r of machineOnly) assert.ok(findings.some((f) => f.code === 'HFS_RULE_CODE_UNEMITTED' && f.rule === r.id), r.id);
});

test('a code the machine or starci app check can emit that no rule lists is unowned; an infrastructure refusal is exempt (RED19)', () => {
  const catalog = loadRuleCatalog();
  const [rule] = catalog.rules;
  const owned = rule.failureCodes[0];
  const codes = { machine: [owned, 'ARCH_CODE_NOBODY_OWNS', 'ARCH_CANNOT_JUDGE'], hfs: ['HFS_CODE_NOBODY_OWNS', 'ARCH_CODE_NOBODY_OWNS'], refusals: ['ARCH_CANNOT_JUDGE'] };
  const findings = run(catalog, { codes });
  assert.deepEqual(findings.map((f) => f.code), ['HFS_RULE_CODE_UNOWNED', 'HFS_RULE_CODE_UNOWNED']);
  assert.ok(findings[0].message.startsWith('ARCH_CODE_NOBODY_OWNS can be emitted by the machine check'), findings[0].message);
  assert.ok(findings[1].message.startsWith('HFS_CODE_NOBODY_OWNS can be emitted by the starci app check'), findings[1].message);
  // Owned codes, sub-codes of a rule and refusals alone leave the check clean.
  const subCodes = catalog.rules.flatMap((r) => r.failureCodes);
  assert.deepEqual(run(catalog, { codes: { machine: [...subCodes, 'ARCH_CANNOT_JUDGE'], hfs: subCodes, refusals: ['ARCH_CANNOT_JUDGE'] } }), []);
});

test('a plugin rule no catalog entry names is uncatalogued', () => {
  const catalog = loadRuleCatalog();
  const plugins = pluginsOf(catalog);
  plugins['eslint-be'].ids.add('rule-nobody-owns');
  const findings = run(catalog, { plugins });
  assert.deepEqual(findings.map((f) => [f.code, f.enforcer]), [['HFS_RULE_UNCATALOGUED', 'eslint-be:rule-nobody-owns']]);
});

test('an enforcer without a violating and a passing proof is untested', () => {
  const catalog = loadRuleCatalog();
  const r38 = catalog.rule('R38');
  const proven = { 'eslint-be': 'tester.run("error-home", rule, { valid: [], invalid: [{ code: "x" }] })', 'eslint-fe': '', specs: [] };
  const only = { ...catalog, rules: [{ ...r38, kinds: ['lint'], enforcers: r38.enforcers.filter((e) => e.kind === 'eslint-be' && e.id === 'error-home') }] };
  assert.deepEqual(run(only, { tests: proven }), []);
  const validOnly = { ...proven, 'eslint-be': 'tester.run("error-home", rule, { valid: ["x"], invalid: [] })' };
  assert.deepEqual(run(only, { tests: validOnly }).map((f) => f.code), ['HFS_RULE_UNTESTED']);
  const r12 = catalog.rule('R12');
  const machine = { ...catalog, rules: [r12] };
  const twoTests = `test('finding', () => { '${r12.code}' })
test('clean', () => { '${r12.code}' })`;
  assert.deepEqual(run(machine, { tests: { 'eslint-be': '', 'eslint-fe': '', specs: [twoTests] } }), []);
  assert.deepEqual(run(machine, { tests: { 'eslint-be': '', 'eslint-fe': '', specs: [`test('one', () => { '${r12.code}' })`] } }).map((f) => f.code), ['HFS_RULE_UNTESTED']);
});

test('a knowledge file names a rule code only if the catalog or the failure catalog has it (RED20: one obligation, one rule system)', () => {
  const catalog = loadRuleCatalog();
  const file = (text) => ({ rel: 'knowledge/patterns/be/example.yaml', text });
  // only the RED20 findings: the fixture file stubs above answer for the machine enforcers, which is another test's subject
  const red20 = (over) => run(catalog, over).filter((f) => f.code === 'HFS_RULE_CODE_UNCATALOGUED' && f.rule === '-');
  assert.deepEqual(red20({ knowledge: [file('BE_TIER_DIRECTION and HFS_SLOT_UNDECLARED judge it; NEST_ANYTHING and R26 are not codes of these families')] }), []);
  const stray = red20({ knowledge: [file(['- BE_SQL_OUTSIDE_REPOSITORY', '- BE_SQL_OUTSIDE_REPOSITORY', '- FE_GONE_CODE'].join(String.fromCharCode(10)))] });
  assert.deepEqual(stray.map((f) => [f.code, f.rule]), [['HFS_RULE_CODE_UNCATALOGUED', '-'], ['HFS_RULE_CODE_UNCATALOGUED', '-']]);
  assert.ok(stray.every((f) => f.message.startsWith('knowledge/patterns/be/example.yaml names ')));
  assert.deepEqual(stray.map((f) => / names ([A-Z0-9_]+),/.exec(f.message)?.[1]), ['BE_SQL_OUTSIDE_REPOSITORY', 'FE_GONE_CODE']);
  // a code that only the failure catalog knows (a sub-code of a rule) is fine
  const sub = { ...failureCatalog(catalog), ARCH_ONLY_IN_FAILURE_CATALOG: { ...codeEntry } };
  assert.deepEqual(red20({ failureCodes: sub, knowledge: [file('ARCH_ONLY_IN_FAILURE_CATALOG')] }), []);
  // a prefix that is not a whole code (`HFS_` alone, `BE` inside a word) is not a code
  assert.deepEqual(red20({ knowledge: [file('HFS_ WEBE_X ABE_Y')] }), []);
});

test('the knowledge files RED20 reads are the pattern tree and the rule manifests, YAML only, and a retired file is skipped', () => {
  assert.deepEqual([...KNOWLEDGE_CODE_ROOTS], ['knowledge/patterns', 'knowledge/architecture-rules.yaml', 'modules/models/code-patterns.yaml']);
  const files = readKnowledgeFiles(root);
  assert.ok(files.length > 0 && files.every((f) => f.rel.endsWith('.yaml') && typeof f.text === 'string'));
  assert.ok(files.some((f) => f.rel === 'knowledge/patterns/be/persistence.yaml') && files.some((f) => f.rel === 'modules/models/code-patterns.yaml'));
  assert.deepEqual(readKnowledgeFiles(path.join(root, 'no-such-runtime')), []);
});

test('pluginRuleIds reads the rule names of a plugin and reports one that cannot load', async () => {
  assert.deepEqual(Object.keys(PLUGIN_ENTRY), ['eslint-be', 'eslint-fe', 'stylelint']);
  const found = await pluginRuleIds(root, 'eslint-be');
  assert.ok(found.ids instanceof Set && found.ids.size > 0);
  const lost = await pluginRuleIds(path.join(root, 'no-such-runtime'), 'eslint-fe');
  assert.match(lost.error, /packages\/eslint\/fe\/index\.mjs cannot be loaded/);
});

// ------------------------------------------------------------------------------------------------ stylelint enforcers

const styleRule = (id) => ({ ...loadRuleCatalog().rule('R61'), enforcers: [{ kind: 'stylelint', id }] });
const lines = (...parts) => parts.join('\n');
const styleTest = (id, body) => lines('import { lintRule } from "./testing.mjs"', `const rule = (code) => lintRule("${id}", code)`, body);
const PASSING = lines('test("accepts a token", async () => {', '  assert.deepEqual(await rule(".a { color: var(--accent); }"), [])', '})', '');
const VIOLATING = lines('test("refuses a raw value", async () => {', '  const warnings = await rule(".a { color: red; }")', '  assert.equal(warnings.length, 1)', '})', '');

test('a stylelint enforcer must be a rule of packages/stylelint, a shipped one may not stay planned, and a shipped rule must be named', () => {
  const catalog = loadRuleCatalog();
  const plugins = pluginsOf(catalog);
  plugins.stylelint.ids.delete('token-only');
  assert.deepEqual(run(catalog, { plugins }).map((f) => [f.code, f.rule, f.enforcer]), [['HFS_RULE_ENFORCER_MISSING', 'R61', 'stylelint:token-only']]);
  const planned = { ...catalog, rules: catalog.rules.map((r) => (r.id === 'R61' ? { ...r, enforcers: r.enforcers.map((e) => (e.id === 'token-only' && e.kind === 'stylelint' ? { ...e, planned: true } : e)) } : r)) };
  assert.deepEqual(run(planned, { plugins: pluginsOf(catalog) }).map((f) => [f.code, f.enforcer]), [['HFS_RULE_ENFORCER_PLANNED', 'stylelint:token-only'], ['HFS_RULE_ENFORCER_STALE', 'stylelint:token-only']]);
  const extra = pluginsOf(catalog);
  extra.stylelint.ids.add('rule-nobody-owns');
  assert.deepEqual(run(catalog, { plugins: extra }).map((f) => [f.code, f.enforcer]), [['HFS_RULE_UNCATALOGUED', 'stylelint:rule-nobody-owns']]);
  assert.match(run(catalog, { plugins: { ...pluginsOf(catalog), stylelint: { error: 'packages/stylelint/index.mjs cannot be read (boom)' } } })[0].message, /cannot be read/);
});

test('a stylelint enforcer needs a test file that lints it, with a test asserting no warning and one asserting a warning', () => {
  const only = { ...loadRuleCatalog(), rules: [styleRule('token-only')] };
  const tests = (files) => ({ 'eslint-be': '', 'eslint-fe': '', stylelint: files, specs: [] });
  assert.deepEqual(run(only, { tests: tests([styleTest('token-only', PASSING + VIOLATING)]) }).filter((f) => f.code === 'HFS_RULE_UNTESTED'), []);
  for (const [name, files] of [
    ['no test file', []],
    ['a passing case only', [styleTest('token-only', PASSING)]],
    ['a violating case only', [styleTest('token-only', VIOLATING)]],
    ['a file that lints another rule', [styleTest('no-important', PASSING + VIOLATING)]],
  ]) assert.deepEqual(run(only, { tests: tests(files) }).filter((f) => f.code === 'HFS_RULE_UNTESTED').map((f) => f.enforcer), ['stylelint:token-only'], name);
});

test('stylelintRuleIds reads the rules and their finding codes from the package source, and reports a missing package', () => {
  const found = stylelintRuleIds(root);
  assert.ok(found.ids.has('token-only') && found.ids.has('source-resolves'));
  assert.equal(found.why.get('source-resolves'), 'FE_STYLE_SOURCE_UNRESOLVED');
  assert.equal(found.why.get('no-inline-lint-config'), 'HFS_INLINE_SUPPRESSION');
  assert.match(stylelintRuleIds(path.join(root, 'no-such-runtime')).error, /packages\/stylelint\/index\.mjs cannot be read/);
});

test('the shipped runtime passes its own check: every eslint id exists and every code is catalogued in Vietnamese', async () => {
  const result = await checkHfsRules(root);
  assert.equal(result.refusal, undefined);
  assert.deepEqual(result.findings, []);
});

test('a failure-catalog code of the rule system that no rule owns and no infrastructure list declares is unowned (S7-02)', () => {
  const catalog = loadRuleCatalog();
  const failureCodes = { ...failureCatalog(catalog), HFS_TOOL_ONLY: {}, HFS_DECLARED_TOOL: {} };
  const findings = run(catalog, { failureCodes, infrastructure: { HFS_DECLARED_TOOL: 'scripts/x.mjs' } });
  assert.deepEqual(findings.map((f) => f.code), ['HFS_RULE_CODE_UNOWNED']);
  assert.ok(findings[0].message.startsWith('HFS_TOOL_ONLY is in modules/kernel/failure-codes.yaml'), findings[0].message);
  assert.deepEqual(run(catalog, { failureCodes: { ...failureCatalog(catalog), HFS_DECLARED_TOOL: {} }, infrastructure: { HFS_DECLARED_TOOL: 'scripts/x.mjs' } }), []);
});

test('a declared infrastructure code that a rule owns, or the catalog lacks, is stale', () => {
  const catalog = loadRuleCatalog();
  const ownedCode = catalog.rules[0].code;
  const findings = run(catalog, { infrastructure: { [ownedCode]: 'scripts/x.mjs', HFS_GONE_TOOL: 'scripts/x.mjs' } });
  assert.deepEqual(findings.map((f) => f.code), ['HFS_RULE_CODE_UNOWNED', 'HFS_RULE_CODE_UNOWNED']);
});
