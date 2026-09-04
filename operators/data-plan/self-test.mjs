// Proves validate.mjs on a synthetic session branch: one lawful plan of two units with their own
// namespaces and targets, one gate stop, one SEED_UNDEFINED stop with its reason, and one mutation per
// law, each of which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateDataPlanStep } from './validate.mjs';

const OPERATOR = 'data.plan';
const FEATURE = 'items';
const HEAD = 'a'.repeat(40);
const UNITS = [
  { id: 'open-item', kind: 'table', goal: 'the items a viewer opens stand in the catalogue at the list volume', inputs: [], dependsOn: [] },
  { id: 'item-catalogue', kind: 'table', goal: 'the catalogue the list page shows stands at its density before the page is judged', inputs: [], dependsOn: ['open-item'] },
];
const ROWS = {
  'open-item': { serves: 'flow `open-item`', namespace: 'uat-open-item', targets: [['items', 'owner', 3, "every items row the unit's account owns"]] },
  'item-catalogue': { serves: 'family `catalogue`', namespace: 'uat-item-catalogue', targets: [['items', 'prefix', 24, "every items row whose id carries the unit's prefix"], ['categories', 'prefix', 4, "every categories row whose id carries the unit's prefix"]] },
};
const unitsDoc = (units = UNITS, producedBy = OPERATOR) => ({ schemaVersion: 9, producedBy, units });
function receiptOf(units, { feature = FEATURE, rows = ROWS, extraRows = [], extraTargets = [], goals = {} } = {}) {
  const unitRows = [...units.map((u) => { const r = rows[u.id]; return `| \`${u.id}\` | ${r.serves} | \`${r.namespace}\` | ${goals[u.id] ?? u.goal} |`; }), ...extraRows].join('\n');
  const targetRows = [...units.flatMap((u) => (rows[u.id].targets ?? []).map(([store, attribution, volume, rollback]) => `| \`${u.id}\` | \`${store}\` | ${attribution} | ${volume} | ${rollback} |`)), ...extraTargets].join('\n');
  return `# seed-plan — ${feature}

The goal names ${units.length} seeds of the ${feature} feature; each becomes one unit with its own namespace and its targets.

## Units

| Unit | Serves | Namespace | Goal |
| --- | --- | --- | --- |
${unitRows}

## Targets

| Unit | Store | Attribution | Volume | Rollback |
| --- | --- | --- | --- | --- |
${targetRows}

## Fallbacks taken

| Code | Action |
| --- | --- |
`;
}
const requestJson = ({ feature = FEATURE } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@workspaces/be', head: HEAD }, { alias: '@worktrees/_templates', head: null }, { alias: '@worktrees/uat/open-item', head: null }],
  requirements: { goal: 'a viewer opens an item from a catalogue shown at its real density', feature, env: 'dev', resume: null },
  inputs: {}, resume: null,
});
const responseJson = ({ status = 'done', stop, reason, fields = null, next = ['data.seed'] } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks: [],
  fields: fields ?? { 'seed-plan': 'response/response.md', units: 'response/data/units.json' },
  ...(reason ? { reason } : {}), commits: [], next,
});

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'data-plan-'));
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
  const { errors } = await validateDataPlanStep(branch);
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
const REASON = 'The goal names the viewer\'s reading history, and no entity, table or collection at the frozen head holds a reading history row.';
const rowsWith = (id, patch) => ({ ...ROWS, [id]: { ...ROWS[id], ...patch } });
const blocked = (stop, extra = {}) => ({ ...lawful(), 'response/response.json': responseJson({ status: 'blocked', stop, fields: {}, next: [], ...extra }), 'response/response.md': null, 'response/data/units.json': null });

await expectValid(lawful(), 'two units with their own namespaces and targets');
await expectValid(blocked('INVALID_INPUT'), 'a gate stop with no plan');
await expectValid(blocked('SEED_UNDEFINED', { reason: REASON }), 'a seed no store can hold, named in its reason');

// One list: the Units table and the unit list agree by id and goal.
await expectError(withUnits(lawful(), unitsDoc([UNITS[0]])), 'Units row item-catalogue has no entry', 'a Units row without a unit');
await expectError(withUnits(lawful(), unitsDoc([...UNITS, { id: 'reading-history', kind: 'table', goal: 'the history stands', inputs: [], dependsOn: [] }])), 'unit reading-history has no Units row', 'a unit without a Units row');
await expectError(lawful(UNITS, { goals: { 'open-item': 'another goal' } }), 'Units row open-item goal differs', 'a goal that differs between the table and the list');
await expectError(withUnits(lawful(), unitsDoc([UNITS[0], { ...UNITS[1], kind: 'flow' }])), 'is a flow; a unit of a seed plan is a table', 'a flow planned as a seed');
await expectError(withUnits(lawful(), unitsDoc([...UNITS, { ...UNITS[0] }])), 'is declared twice', 'a unit id declared twice');
await expectError(withUnits(lawful(), unitsDoc([UNITS[0], { ...UNITS[1], dependsOn: ['reading-history'] }])), 'depends on reading-history, which this file does not declare', 'a dependency on a unit the plan does not name');
await expectError(withUnits(lawful(), unitsDoc(UNITS, 'uat.plan')), 'producedBy uat.plan is not data.plan', 'a unit list another operator signed');
await expectError(withUnits(lawful(), unitsDoc([UNITS[0], { ...UNITS[1], goal: '' }])), 'goal', 'a unit with no goal');
await expectError(lawful(UNITS, { extraRows: ['| `open-item` | flow `open-item` | `uat-open-item-2` | the items stand |'] }), 'Units lists open-item twice', 'a unit listed twice');
await expectError({ ...lawful([]), 'response/data/units.json': unitsDoc([]) }, 'a plan with zero units is a stop', 'a done plan that names nothing');

// Every unit owns its namespace and has its targets.
await expectError(lawful(UNITS, { rows: rowsWith('item-catalogue', { namespace: 'uat-open-item' }) }), 'share the namespace uat-open-item', 'two units on one namespace');
await expectError(lawful(UNITS, { rows: rowsWith('item-catalogue', { targets: [] }) }), 'unit item-catalogue has no Targets row', 'a unit with no target');
await expectError(lawful(UNITS, { extraTargets: ['| `reading-history` | `history` | prefix | 2 | every history row under the prefix |'] }), 'Targets names reading-history, which Units does not', 'a target for a unit the plan does not name');
await expectError(lawful(UNITS, { extraTargets: ['| `open-item` | `items` | prefix | 9 | every items row under the prefix |'] }), 'Targets lists items twice for open-item', 'one store named twice for one unit');
await expectError(lawful(UNITS, { rows: rowsWith('open-item', { targets: [['items', 'column', 3, 'every row']] }) }), 'cell Attribution "column" does not match', 'an attribution outside the isolation law');
await expectError(lawful(UNITS, { rows: rowsWith('open-item', { targets: [['items', 'owner', 0, 'every row']] }) }), 'cell Volume "0" does not match', 'a target with no volume');
await expectError(lawful(UNITS, { rows: rowsWith('open-item', { namespace: 'Uat Open' }) }), 'cell Namespace', 'a namespace that is not a slug');

// Title, gate and stop shape.
await expectError({ ...lawful(), 'request/request.json': requestJson({ feature: 'archive' }) }, 'the request names feature archive', 'a plan titled by another feature');
await expectError(blocked('SEED_UNDEFINED'), 'carries a reason naming the flow or family', 'an undefined seed with no reason');
await expectError(blocked('SEED_UNDEFINED', { reason: 'two families:\nhistory\nbadges' }), 'spans more than one paragraph', 'a reason in several paragraphs');
await expectError({ ...lawful(), 'response/response.json': responseJson({ status: 'blocked', stop: 'SEED_UNDEFINED', reason: REASON, next: [] }) }, 'emits no plan', 'an undefined seed that still emitted a plan');
await expectError({ ...lawful(), 'response/response.json': responseJson({ next: ['git.publish'] }) }, 'which the Next table of data.plan does not offer', 'a hand-off the Next table does not offer');

process.stdout.write('data.plan self-test: one lawful plan, two lawful stops and every mutation refused\n');
