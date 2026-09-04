// Proves validate.mjs on a synthetic session branch: one lawful map of a page and its modal, one gate
// stop, one MAP_INCOMPLETE stop with its reason, and one mutation per law, each of which must fail with
// a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateInterfacePlanStep } from './validate.mjs';

const OPERATOR = 'interface.plan';
const FEATURE = 'items';
const HEAD = 'a'.repeat(40);
const UNITS = [
  { id: 'item-list', kind: 'page', goal: 'list every item the viewer may open, with its state', inputs: [], dependsOn: [] },
  { id: 'item-remove-confirm', kind: 'modal', goal: 'confirm the removal of one item before it happens', inputs: [], dependsOn: ['item-list'] },
];
const ROUTE = { 'item-list': '`/items`', 'item-remove-confirm': 'hosted by `item-list`' };
const SHELL = [
  ['sidebar', 'the feature layout', "the family's navigation composition with the feature entries in the order below"],
  ['header', 'the feature layout', "the family's header composition carrying the feature title"],
  ['breadcrumb', 'each page', "the family's breadcrumb composition rooted at the feature entry"],
  ['navigation order', 'the feature layout', 'items, then archive'],
];
const unitsDoc = (units = UNITS, producedBy = OPERATOR) => ({ schemaVersion: 9, producedBy, units });
function receiptOf(units, { feature = FEATURE, shell = SHELL, contracts = null, mapKind = {} } = {}) {
  const map = units.map((u) => `| \`${u.id}\` | ${mapKind[u.id] ?? u.kind} | ${ROUTE[u.id] ?? '`/other`'} | ${u.goal} |`).join('\n');
  const rows = contracts ?? units.map((u) => [u.id, 'the item operations the unit reads', u.kind === 'modal' ? 'the item removal operation' : '—']);
  const contractText = rows.map(([id, reads, writes]) => `| \`${id}\` | ${reads} | ${writes} |`).join('\n');
  const shellText = shell.map((r) => `| ${r.join(' | ')} |`).join('\n');
  return `# surface-map — ${feature}

The ${feature} feature mapped from the person's reference and the source at the frozen head: ${units.length} units under one shell.

## Map

| Unit | Kind | Route or host | Goal |
| --- | --- | --- | --- |
${map}

## Shell

| Element | Owner | Decided |
| --- | --- | --- |
${shellText}${shellText ? '\n' : ''}
## Data contracts

| Unit | Reads | Writes |
| --- | --- | --- |
${contractText}${contractText ? '\n' : ''}
## Fallbacks taken

| Code | Action |
| --- | --- |
`;
}
const requestJson = ({ feature = FEATURE } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@grammar/core', head: null }, { alias: '@workspaces/fe', head: HEAD }],
  requirements: { feature, reference: 'the reference shows an item list and a removal dialog', resume: null },
  inputs: {}, resume: null,
});
const responseJson = ({ status = 'done', stop, reason, fields = null, next = ['interface.generate'] } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks: [],
  fields: fields ?? { 'surface-map': 'response/response.md', units: 'response/data/units.json' },
  ...(reason ? { reason } : {}), commits: [], next,
});

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'interface-plan-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'sample-product', startedAt: '2026-09-05T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': OPERATOR }, current: '1/1', status: 'running' }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}
async function run(files) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateInterfacePlanStep(branch);
  rmSync(session, { recursive: true, force: true });
  return errors;
}
async function expectValid(files, label) { assert.deepEqual(await run(files), [], `${label} should be valid`); }
async function expectError(files, needle, label) {
  const errors = await run(files);
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

const lawful = (units = UNITS, opts = {}) => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': receiptOf(units, opts),
  'response/data/units.json': unitsDoc(units),
});
const withUnits = (files, units) => ({ ...files, 'response/data/units.json': units });
const REASON = 'The source serves `/items/archive` and the reference shows an archive page, and no Map row names either.';

await expectValid(lawful(), 'a page and its modal under one shell');
await expectValid({ ...lawful(), 'response/response.json': responseJson({ status: 'blocked', stop: 'INVALID_INPUT', fields: {}, next: [] }), 'response/response.md': null, 'response/data/units.json': null }, 'a gate stop with no map');
await expectValid({ ...lawful(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MAP_INCOMPLETE', reason: REASON, fields: {}, next: [] }), 'response/response.md': null, 'response/data/units.json': null }, 'an incomplete map named in its reason');

// One list: the Map and the unit list agree by id, kind and goal.
await expectError(withUnits(lawful(), unitsDoc([UNITS[0]])), 'Map row item-remove-confirm has no entry', 'a Map row without a unit');
await expectError(withUnits(lawful(), unitsDoc([...UNITS, { id: 'item-detail', kind: 'page', goal: 'show one item', inputs: [], dependsOn: [] }])), 'unit item-detail has no Map row', 'a unit without a Map row');
await expectError(withUnits(lawful(), unitsDoc([UNITS[0], { ...UNITS[1], goal: 'confirm nothing' }])), 'goal differs', 'a goal that differs between the map and the list');
await expectError(lawful(UNITS, { mapKind: { 'item-remove-confirm': 'page' } }), 'is a page, response/data/units.json says modal', 'a kind that differs between the map and the list');
await expectError(withUnits(lawful(), unitsDoc([UNITS[0], { ...UNITS[1], kind: 'flow' }])), 'is a flow; a unit of a surface map is a page or a modal', 'a flow planned as a surface unit');
await expectError(withUnits(lawful(), unitsDoc([...UNITS, { ...UNITS[0] }])), 'is declared twice', 'a unit id declared twice');
await expectError(withUnits(lawful(), unitsDoc([UNITS[0], { ...UNITS[1], dependsOn: ['item-detail'] }])), 'depends on item-detail, which this file does not declare', 'a dependency on a unit the plan does not name');
await expectError(withUnits(lawful(), unitsDoc(UNITS, 'uat.plan')), 'producedBy uat.plan is not interface.plan', 'a unit list another operator signed');
await expectError(withUnits(lawful(), unitsDoc([UNITS[0], { ...UNITS[1], goal: '' }])), 'goal', 'a unit with no goal');

// Shell and data contracts.
await expectError(lawful(UNITS, { shell: [] }), 'needs at least 1 rows', 'a map with no shell decision');
await expectError(lawful(UNITS, { shell: [['footer', 'the feature layout', 'none']] }), 'cell Element "footer" does not match', 'a shell element outside the vocabulary');
await expectError(lawful(UNITS, { contracts: [['item-list', 'the item list operation', '—']] }), 'unit item-remove-confirm has no Data contracts row', 'a unit with no data contract');
await expectError(lawful(UNITS, { contracts: [['item-list', 'x', '—'], ['item-remove-confirm', 'x', 'y'], ['item-detail', 'x', '—']] }), 'Data contracts names item-detail, which the Map does not', 'a contract for a unit the map does not name');
await expectError(lawful(UNITS, { contracts: [['item-list', 'x', '—'], ['item-list', 'x', '—'], ['item-remove-confirm', 'x', 'y']] }), 'Data contracts lists item-list twice', 'a unit with two contracts');

// Title, gate and stop shape.
await expectError({ ...lawful(), 'request/request.json': requestJson({ feature: 'archive' }) }, 'the request names feature archive', 'a map titled by another feature');
await expectError({ ...lawful(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MAP_INCOMPLETE', fields: {}, next: [] }), 'response/response.md': null, 'response/data/units.json': null }, 'carries a reason naming the route or host', 'an incomplete map with no reason');
await expectError({ ...lawful(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MAP_INCOMPLETE', reason: 'two routes:\n/a\n/b', fields: {}, next: [] }), 'response/response.md': null, 'response/data/units.json': null }, 'spans more than one paragraph', 'a reason in several paragraphs');
await expectError({ ...lawful(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MAP_INCOMPLETE', reason: REASON, next: [] }) }, 'emits no map', 'an incomplete map that still emitted a map');
await expectError({ ...lawful(), 'response/response.json': responseJson({ next: ['git.publish'] }) }, 'which the Next table of interface.plan does not offer', 'a hand-off the Next table does not offer');

process.stdout.write('interface.plan self-test: one lawful map, two lawful stops and every mutation refused\n');
