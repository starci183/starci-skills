// runtime-rule-ids.spec.mjs - RT_RULE_ID_UNKNOWN and RT_RULE_UNCITED (scripts/hfs/runtime-rules/rule-ids.mjs):
// every rule id the tracked text names is a rule of the catalog, a gap between ids is accepted, and every catalog rule is
// cited by a pattern topic or is scope: runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadRuleCatalog } from '../../scripts/hfs/slots.mjs';
import { ruleIdFindings } from '../../scripts/hfs/runtime-rules/rule-ids.mjs';

const catalog = loadRuleCatalog();
const ctxOf = (texts) => ({ root: process.cwd(), files: Object.keys(texts), params: { generated: [{ root: 'packages/x/runtime' }] }, read: (file) => texts[file] ?? null });
const live = (found) => found.filter((f) => f.code === 'RT_RULE_ID_UNKNOWN').map((f) => [f.path, f.line]);

const catalogText = fs.readFileSync(path.join(process.cwd(), 'knowledge/hfs/rules.yaml'), 'utf8');

test('rule ids: a gap between two ids is accepted; a duplicate or malformed id is refused by the catalog loader', () => {
  const lines = catalogText.split('\n');
  const at = lines.indexOf('  - id: R03');
  const next = lines.findIndex((line, i) => i > at && line.startsWith('  - id: R'));
  const swap = (id) => lines.map((line, i) => (i === at ? `  - id: ${id}` : line)).join('\n');
  const gapped = [...lines.slice(0, at), ...lines.slice(next)].join('\n');
  assert.ok(at > 0 && next > at);
  assert.ok(!loadRuleCatalog({ text: gapped }).rules.some((r) => r.id === 'R03'), 'a catalog without R03 loads');
  assert.throws(() => loadRuleCatalog({ text: swap('R02') }), /ids must increase/);
  assert.throws(() => loadRuleCatalog({ text: swap('R3') }), /R<two or three digits>/);
});

test('RT_RULE_ID_UNKNOWN: an id no rule has is refused in knowledge, docs and code, with its line', () => {
  const found = ruleIdFindings(ctxOf({ 'knowledge/x.yaml': 'ok R01\nhfsRules: [R01, R999]\n', 'scripts/a.mjs': '// see R888\n' }));
  assert.deepEqual(live(found), [['knowledge/x.yaml', 2], ['scripts/a.mjs', 1]]);
});

test('RT_RULE_ID_UNKNOWN: an unknown id is refused in a changelog and in a live file alike', () => {
  const text = 'Dropped: R999\n';
  assert.deepEqual(live(ruleIdFindings(ctxOf({ 'packages/hfs/CHANGELOG.md': text, 'modules/kernel/current.yaml': text }))), [['packages/hfs/CHANGELOG.md', 1], ['modules/kernel/current.yaml', 1]]);
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
