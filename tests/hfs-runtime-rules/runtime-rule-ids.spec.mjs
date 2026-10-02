// runtime-rule-ids.spec.mjs - RT_RULE_ID_UNKNOWN, RT_RULE_ID_GAP and RT_RULE_UNCITED (scripts/hfs/runtime-rules/rule-ids.mjs):
// every rule id the tracked text names is a rule of the catalog, the id run has no undeclared gap, and every catalog rule is
// cited by a pattern topic or is scope: runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadRuleCatalog } from '../../scripts/hfs/slots.mjs';
import { gapIds, retiredProblems, ruleIdFindings } from '../../scripts/hfs/runtime-rules/rule-ids.mjs';

const catalog = loadRuleCatalog();
const ctxOf = (texts) => ({ root: process.cwd(), files: Object.keys(texts), params: { generated: [{ root: 'packages/x/runtime' }] }, read: (file) => texts[file] ?? null });
const live = (found) => found.filter((f) => f.code === 'RT_RULE_ID_UNKNOWN').map((f) => [f.path, f.line]);

test('RT_RULE_ID_GAP: the shipped catalog has no undeclared gap; a rule or a retired id fills each id', () => {
  assert.deepEqual(gapIds(catalog), []);
  assert.ok(catalog.retired.length > 0 && catalog.retired.every((entry) => entry.reason));
  assert.deepEqual(gapIds({ rules: [{ id: 'R01' }, { id: 'R04' }], retired: [{ id: 'R02' }] }), ['R03']);
});

test('RT_RULE_ID_UNKNOWN: an id no rule has is refused in knowledge, docs and code, with its line', () => {
  const found = ruleIdFindings(ctxOf({ 'knowledge/x.yaml': 'ok R01\nhfsRules: [R01, R999]\n', 'scripts/a.mjs': '// see R888\n' }));
  assert.deepEqual(live(found), [['knowledge/x.yaml', 2], ['scripts/a.mjs', 1]]);
});

test('RT_RULE_ID_UNKNOWN: a retired id is refused in live files and allowed in the history files', () => {
  const retired = catalog.retired[0].id;
  const text = `Retired: ${retired}\n`;
  assert.deepEqual(live(ruleIdFindings(ctxOf({ 'knowledge/patterns/x.yaml': text }))), [['knowledge/patterns/x.yaml', 1]]);
  assert.deepEqual(live(ruleIdFindings(ctxOf({ 'modules/kernel/contract-changes/c.yaml': text, 'packages/hfs/CHANGELOG.md': text }))), []);
});

test('RT_RULE_ID_UNKNOWN: specs, generated copies, lock files and other extensions are not read', () => {
  const text = 'R999\n';
  assert.deepEqual(live(ruleIdFindings(ctxOf({ 'tests/a.spec.mjs': text, 'packages/x/runtime/a.md': text, 'package-lock.json': text, 'assets/a.png': text }))), []);
});

test('RT_RULE_UNCITED: a product rule no knowledge/patterns topic cites is refused, a scope: runtime rule is not', () => {
  const found = ruleIdFindings(ctxOf({ 'knowledge/patterns/x.yaml': 'hfsRules: [R01]\n' }));
  const uncited = found.filter((f) => f.code === 'RT_RULE_UNCITED');
  const product = catalog.rules.filter((r) => r.scope !== 'runtime').map((r) => r.id);
  assert.equal(uncited.length, product.filter((id) => id !== 'R01').length);
  assert.ok(uncited.some((f) => f.message.includes('R02 (')), 'R02 is named by no hfsRules here');
  assert.ok(!uncited.some((f) => f.message.includes('R01 (')), 'R01 is cited');
  assert.ok(!uncited.some((f) => f.message.includes('R114 (')), 'R114 is scope: runtime');
});

test('RT_RULE_UNCITED: every rule of the real catalog is cited by a pattern topic or marked scope: runtime', () => {
  const root = process.cwd();
  const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
  const files = walk('knowledge/patterns').filter((f) => f.endsWith('.yaml'));
  const found = ruleIdFindings({ root, files, params: {}, read: (f) => fs.readFileSync(path.join(root, f), 'utf8') });
  assert.deepEqual(found.filter((f) => f.code === 'RT_RULE_UNCITED'), []);
});

test('RT_RULE_ID_GAP: a retired list that names a live rule, repeats an id or lacks a reason is refused', () => {
  assert.deepEqual(retiredProblems(catalog), []);
  const rules = [{ id: 'R01' }];
  assert.match(retiredProblems({ rules, retired: [{ id: 'R01', reason: 'x' }] })[0], /both a rule and retired/);
  assert.match(retiredProblems({ rules, retired: [{ id: 'R02', reason: 'x' }, { id: 'R02', reason: 'y' }] })[0], /retired twice/);
  assert.match(retiredProblems({ rules, retired: [{ id: 'R02' }] })[0], /needs an id/);
});
