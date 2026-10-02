// runtime-rule-ids.spec.mjs - RT_RULE_ID_UNKNOWN and RT_RULE_ID_GAP (scripts/hfs/runtime-rules/rule-ids.mjs): every rule id
// the tracked text names is a rule of the catalog, and the id run has no undeclared gap.
import test from 'node:test';
import assert from 'node:assert/strict';
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

test('RT_RULE_ID_GAP: a retired list that names a live rule, repeats an id or lacks a reason is refused', () => {
  assert.deepEqual(retiredProblems(catalog), []);
  const rules = [{ id: 'R01' }];
  assert.match(retiredProblems({ rules, retired: [{ id: 'R01', reason: 'x' }] })[0], /both a rule and retired/);
  assert.match(retiredProblems({ rules, retired: [{ id: 'R02', reason: 'x' }, { id: 'R02', reason: 'y' }] })[0], /retired twice/);
  assert.match(retiredProblems({ rules, retired: [{ id: 'R02' }] })[0], /needs an id/);
});
