import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../engine/yaml.mjs';
import { HfsSlotsError, loadRuleCatalog, loadSlotManifest, openHfs, rules } from '../scripts/lib/hfs-slots.mjs';
import { hfsRulesFindings, pluginRuleIds, checkHfsRules, PLUGIN_ENTRY } from '../scripts/checks/check-hfs-rules.mjs';

const root = path.resolve(import.meta.dirname, '..');
const catalogText = fs.readFileSync(path.join(root, 'knowledge/hfs/rules.yaml'), 'utf8');
const schemaText = fs.readFileSync(path.join(root, 'modules/schemas/hfs-rules.schema.yaml'), 'utf8');

const Ajv2020 = (() => { const loaded = createRequire(import.meta.url)('ajv/dist/2020.js'); return loaded.default ?? loaded; })();
const validateSchema = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(schemaText));

const refusal = (fn, code) => assert.throws(fn, (error) => error instanceof HfsSlotsError && error.code === code, `expected ${code}`);
const doc = () => parseYaml(catalogText);
const load = (mutate) => { const d = doc(); mutate(d); return () => loadRuleCatalog({ text: JSON.stringify(d) }); };

test('the shipped catalog is 2.0.0, validates against its JSON schema and loads with the slot manifest major', () => {
  const d = doc();
  assert.equal(d.version, '2.0.0');
  assert.equal(validateSchema(d), true, JSON.stringify(validateSchema.errors));
  const catalog = loadRuleCatalog({ manifest: loadSlotManifest() });
  assert.equal(catalog.major, 2);
  assert.equal(catalog.rules.length, 67);
  catalog.rules.forEach((rule, index) => assert.equal(rule.id, `R${String(index + 1).padStart(2, '0')}`));
  for (const rule of catalog.rules) {
    assert.ok(rule.enforcers.length > 0, `${rule.id} has an enforcer`);
    assert.equal(rule.failureCodes[0], rule.code);
    assert.ok(rule.gates.includes('land'), `${rule.id} runs at land`);
  }
});

test('the loader answers by id, code, gate, enforcer and what is still owed', () => {
  const catalog = loadRuleCatalog();
  assert.equal(catalog.rule('R12').code, 'HFS_E2E_IN_AUTOMATIC_GATE');
  assert.equal(catalog.rule('R99'), null);
  assert.equal(catalog.byCode('FE_NEXT_CONVENTIONS').id, 'R54');
  assert.equal(catalog.byCode('HFS_SLOT_UNDECLARED').id, 'R01');
  assert.equal(catalog.byCode('NOT_A_CODE'), null);
  assert.deepEqual(catalog.forGate('sonar').map((r) => r.id), ['R20', 'R21']);
  assert.deepEqual(catalog.forGate('pre-commit').map((r) => r.id).filter((id) => ['R06', 'R18', 'R62'].includes(id)), ['R06', 'R18', 'R62']);
  assert.deepEqual(catalog.forEnforcer('eslint-be', 'error-home').map((r) => r.id), ['R38']);
  assert.deepEqual(catalog.forEnforcer('eslint-fe', 'no-inline-lint-config').map((r) => r.id), ['R18']);
  const unbuilt = catalog.unbuilt().map((r) => r.id);
  assert.ok(unbuilt.includes('R01'), 'R01 has only a planned enforcer');
  assert.ok(!unbuilt.includes('R12'), 'R12 is enforced by the architecture machine today');
  assert.ok(!unbuilt.includes('R58'), 'R58 is enforced by eslint-fe');
  assert.ok(catalog.planned().every((p) => p.rule && p.kind && p.id));
  assert.deepEqual(Object.keys(catalog.gates), ['pre-commit', 'pre-push', 'settle', 'land', 'ci', 'sonar']);
});

test('rules() and openHfs().rules() give the same frozen catalog', () => {
  const list = rules();
  assert.equal(list.length, 67);
  assert.ok(Object.isFrozen(list) && Object.isFrozen(list[0]) && Object.isFrozen(list[0].enforcers));
  const be = { hfs: 2, profile: 'be', project: 'nivo', apps: [{ name: 'core', kind: 'api' }, { name: 'worker', kind: 'worker' }, { name: 'migrate', kind: 'migrate' }], optionalSlots: ['be.transport.schedule', 'be.contract.graphql', 'repo.docs'], connections: ['primary', 'agentos'] };
  assert.equal(openHfs({ declaration: be }).rules().rules.length, 67);
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
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const broken = doc();
    mutate(broken);
    assert.equal(validateSchema(broken), false, `schema accepted: ${name}`);
    refusal(load(mutate), 'HFS_RULES_INVALID');
  }
});

test('the loader also refuses what only semantics can see', () => {
  refusal(load((d) => { d.rules[1].id = 'R05'; }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.rules[1].failureCodes = [d.rules[1].code, d.rules[0].code]; }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.rules[0].failureCodes = ['HFS_SOMETHING_ELSE']; }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.rules[0].gates = ['pre-push', 'settle']; }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.rules[5].gates = ['pre-commit', 'land', 'ci']; }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.rules[0].gates.push('sonar'); }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.rules[0].enforcers[0].at = 'scripts/x.mjs'; }), 'HFS_RULES_INVALID');
  refusal(load((d) => { d.rules[0].enforcers[0].status = undefined; }), 'HFS_RULES_INVALID');
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

const codeEntry = { title_vi: 'Tiêu đề', meaning_vi: 'Ý nghĩa của lỗi', nextStep_vi: 'Bước tiếp theo' };
const failureCatalog = (catalog, without = []) => Object.fromEntries(catalog.rules.flatMap((r) => r.failureCodes).filter((c) => !without.includes(c)).map((c) => [c, { ...codeEntry }]));
const allFiles = { exists: () => true, read: () => 'HFS_E2E_IN_AUTOMATIC_GATE BE_APP_COMPOSITION_ONLY SEALED_CUSTODY_LOCATION ARCH_OWNER_EXPORT_BYPASS' };
const pluginsOf = (catalog) => {
  const ids = (kind) => new Set(catalog.rules.flatMap((r) => r.enforcers).filter((e) => e.kind === kind && !e.planned).map((e) => e.id));
  return { 'eslint-be': { ids: ids('eslint-be') }, 'eslint-fe': { ids: ids('eslint-fe') } };
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
  const catalog = loadRuleCatalog();
  const plugins = pluginsOf(catalog);
  plugins['eslint-be'].ids.add('input-bounded');
  const findings = run(catalog, { plugins });
  assert.deepEqual(findings.map((f) => [f.code, f.rule, f.enforcer]), [['HFS_RULE_ENFORCER_STALE', 'R42', 'eslint-be:input-bounded']]);
});

test('an existing machine enforcer needs its file to exist and to emit the rule code', () => {
  const catalog = loadRuleCatalog();
  const missing = run(catalog, { files: { exists: (rel) => rel !== 'scripts/checks/architecture/hfs.mjs', read: allFiles.read } });
  assert.deepEqual(missing.map((f) => [f.code, f.rule]), [['HFS_RULE_ENFORCER_MISSING', 'R12']]);
  const silent = run(catalog, { files: { exists: () => true, read: () => 'nothing here' } });
  assert.ok(silent.length >= 3 && silent.every((f) => f.code === 'HFS_RULE_ENFORCER_MISSING'));
});

test('a rule with no enforcer, or a lint kind with no lint enforcer, is a finding', () => {
  const catalog = loadRuleCatalog();
  const bare = { ...catalog, rules: catalog.rules.map((r) => (r.id === 'R01' ? { ...r, enforcers: [] } : r.id === 'R06' ? { ...r, kinds: ['lint'] } : r)) };
  const findings = run(bare);
  assert.deepEqual(findings.map((f) => [f.code, f.rule]), [['HFS_RULE_NO_ENFORCER', 'R01'], ['HFS_RULE_NO_ENFORCER', 'R01'], ['HFS_RULE_NO_ENFORCER', 'R06']]);
});

test('a failure code with no catalog entry, or an entry that is not Vietnamese, is a finding', () => {
  const catalog = loadRuleCatalog();
  const gone = run(catalog, { failureCodes: failureCatalog(catalog, ['FE_NEXT_CONVENTIONS']) });
  assert.deepEqual(gone.map((f) => [f.code, f.rule]), [['HFS_RULE_CODE_UNCATALOGUED', 'R54']]);
  const english = failureCatalog(catalog);
  english.HFS_SLOT_UNDECLARED = { title_vi: 'Path matches no slot', meaning_vi: 'Đường dẫn không hợp lệ', nextStep_vi: '' };
  const findings = run(catalog, { failureCodes: english });
  assert.deepEqual(findings.map((f) => f.message.includes('title_vi') || f.message.includes('nextStep_vi')), [true, true]);
  assert.ok(findings.every((f) => f.code === 'HFS_RULE_CODE_UNCATALOGUED' && f.rule === 'R01'));
});

test('pluginRuleIds reads the rule names of a plugin and reports one that cannot load', async () => {
  assert.deepEqual(Object.keys(PLUGIN_ENTRY), ['eslint-be', 'eslint-fe']);
  const found = await pluginRuleIds(root, 'eslint-be');
  assert.ok(found.ids instanceof Set && found.ids.size > 0);
  const lost = await pluginRuleIds(path.join(root, 'no-such-runtime'), 'eslint-fe');
  assert.match(lost.error, /packages\/eslint\/fe\/index\.mjs cannot be loaded/);
});

test('the shipped runtime passes its own check: every eslint id exists and every code is catalogued in Vietnamese', async () => {
  const result = await checkHfsRules(root);
  assert.equal(result.refusal, undefined);
  assert.deepEqual(result.findings, []);
});
