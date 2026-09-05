// Proves validate.mjs on a synthetic session branch: one lawful plan of two flows with their own
// aliases and namespaces, one gate stop, one FLOW_UNDEFINED stop with its reason, and one mutation per
// law, each of which must fail with a line that names the defect. The ledger half runs against a
// synthetic ledger root, so the tree's own @worktrees/unchecked is never read.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateUatPlanStep } from './validate.mjs';
import { uncheckedId, ledgerFile } from '../../scripts/unchecked.mjs';

const OPERATOR = 'uat.plan';
const FEATURE = 'items';
const UNITS = [
  { id: 'open-item', kind: 'flow', goal: 'a viewer opens one item from the list and reads its state', inputs: [], dependsOn: [] },
  { id: 'remove-item', kind: 'flow', goal: 'a viewer removes one item and the list no longer shows it', inputs: [], dependsOn: ['open-item'] },
];
const ROWS = {
  'open-item': { entry: '`/items`', steps: 4, alias: 'viewer-open', namespace: 'uat-open-item' },
  'remove-item': { entry: '`/items`', steps: 5, alias: 'viewer-remove', namespace: 'uat-remove-item' },
};
const unitsDoc = (units = UNITS, producedBy = OPERATOR) => ({ schemaVersion: 9, producedBy, units });
function receiptOf(units, { feature = FEATURE, rows = ROWS, extraRows = [], tierCell = {} } = {}) {
  const tierOfRow = (u) => tierCell[u.id] ?? (u.tier === 'secondary' ? `secondary — ${u.deferral?.reason ?? ''}` : 'journey');
  const flows = [...units.map((u) => { const r = rows[u.id]; return `| \`${u.id}\` | ${r.entry} | ${r.steps} | \`${r.alias}\` | \`${r.namespace}\` | ${tierOfRow(u)} |`; }), ...extraRows].join('\n');
  return `# uat-plan — ${feature}

The goal names ${units.length} journeys of the ${feature} feature; each becomes one flow with its own account alias and seed namespace.

## Flows

| Flow | Entry | Steps | Account | Seed namespace | Tier |
| --- | --- | --- | --- | --- | --- |
${flows}

## Fallbacks taken

| Code | Action |
| --- | --- |
`;
}
const requestJson = ({ feature = FEATURE } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@worktrees/_templates', head: null }, { alias: '@worktrees/uat/open-item', head: null }],
  requirements: { goal: 'a viewer opens an item and a viewer removes an item', feature, env: 'dev', resume: null },
  inputs: {}, resume: null,
});
const responseJson = ({ status = 'done', stop, reason, fields = null, next = ['uat.verify'] } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks: [],
  fields: fields ?? { 'uat-plan': 'response/response.md', units: 'response/data/units.json' },
  ...(reason ? { reason } : {}), commits: [], next,
});

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'uat-plan-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'sample-product', startedAt: '2026-09-05T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': OPERATOR }, current: '1/1', status: 'running' }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}
async function run(files, { unchecked = [] } = {}) {
  const { branch, session } = writeBranch(files);
  const uncheckedRoot = mkdtempSync(path.join(tmpdir(), 'unchecked-'));
  if (unchecked.length) {
    const file = ledgerFile(uncheckedRoot, 'sample-product', FEATURE);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, unchecked.map((d) => JSON.stringify(d)).join('\n') + '\n');
  }
  const { errors } = await validateUatPlanStep(branch, undefined, { uncheckedRoot });
  rmSync(session, { recursive: true, force: true });
  rmSync(uncheckedRoot, { recursive: true, force: true });
  return errors;
}
async function expectValid(files, label, options) { assert.deepEqual(await run(files, options), [], `${label} should be valid`); }
async function expectError(files, needle, label, options) {
  const errors = await run(files, options);
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

const lawful = (units = UNITS, opts = {}) => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': receiptOf(units, opts),
  'response/data/units.json': unitsDoc(units),
});
const withUnits = (files, units) => ({ ...files, 'response/data/units.json': units });
const REASON = 'The goal names a viewer archiving an item, and neither the surface map nor a flow folder shows where archiving begins.';
const rowsWith = (id, patch) => ({ ...ROWS, [id]: { ...ROWS[id], ...patch } });

await expectValid(lawful(), 'two flows with their own aliases and namespaces');
await expectValid({ ...lawful(), 'response/response.json': responseJson({ status: 'blocked', stop: 'INVALID_INPUT', fields: {}, next: [] }), 'response/response.md': null, 'response/data/units.json': null }, 'a gate stop with no plan');
await expectValid({ ...lawful(), 'response/response.json': responseJson({ status: 'blocked', stop: 'FLOW_UNDEFINED', reason: REASON, fields: {}, next: [] }), 'response/response.md': null, 'response/data/units.json': null }, 'a journey without an entry named in its reason');

// One list: the Flows table and the unit list agree by id.
await expectError(withUnits(lawful(), unitsDoc([UNITS[0]])), 'Flows row remove-item has no entry', 'a Flows row without a unit');
await expectError(withUnits(lawful(), unitsDoc([...UNITS, { id: 'archive-item', kind: 'flow', goal: 'a viewer archives an item', inputs: [], dependsOn: [] }])), 'unit archive-item has no Flows row', 'a unit without a Flows row');
await expectError(withUnits(lawful(), unitsDoc([UNITS[0], { ...UNITS[1], kind: 'page' }])), 'is a page; a unit of a UAT plan is a flow', 'a page planned as a flow');
await expectError(withUnits(lawful(), unitsDoc([...UNITS, { ...UNITS[0] }])), 'is declared twice', 'a unit id declared twice');
await expectError(withUnits(lawful(), unitsDoc([UNITS[0], { ...UNITS[1], dependsOn: ['archive-item'] }])), 'depends on archive-item, which this file does not declare', 'a dependency on a flow the plan does not name');
await expectError(withUnits(lawful(), unitsDoc(UNITS, 'interface.plan')), 'producedBy interface.plan is not uat.plan', 'a unit list another operator signed');
await expectError(withUnits(lawful(), unitsDoc([UNITS[0], { ...UNITS[1], goal: '' }])), 'goal', 'a flow with no goal');
await expectError(lawful(UNITS, { extraRows: ['| `open-item` | `/items` | 4 | `viewer-open-2` | `uat-open-item-2` |'] }), 'Flows lists open-item twice', 'a flow listed twice');

// Every flow owns its alias and its namespace.
await expectError(lawful(UNITS, { rows: rowsWith('remove-item', { alias: 'viewer-open' }) }), 'share the account alias viewer-open', 'two flows on one account');
await expectError(lawful(UNITS, { rows: rowsWith('remove-item', { namespace: 'uat-open-item' }) }), 'share the seed namespace uat-open-item', 'two flows on one namespace');
await expectError(lawful(UNITS, { rows: rowsWith('remove-item', { namespace: 'remove-item' }) }), 'cell Seed namespace', 'a namespace outside the UAT prefix');
await expectError(lawful(UNITS, { rows: rowsWith('remove-item', { steps: 0 }) }), 'cell Steps "0" does not match', 'a flow with no step budget');

// Title, gate and stop shape.
await expectError({ ...lawful(), 'request/request.json': requestJson({ feature: 'archive' }) }, 'the request names feature archive', 'a plan titled by another feature');
await expectError({ ...lawful(), 'response/response.json': responseJson({ status: 'blocked', stop: 'FLOW_UNDEFINED', fields: {}, next: [] }), 'response/response.md': null, 'response/data/units.json': null }, 'carries a reason naming the journey', 'an undefined flow with no reason');
await expectError({ ...lawful(), 'response/response.json': responseJson({ status: 'blocked', stop: 'FLOW_UNDEFINED', reason: 'two journeys:\narchive\nrestore', fields: {}, next: [] }), 'response/response.md': null, 'response/data/units.json': null }, 'spans more than one paragraph', 'a reason in several paragraphs');
await expectError({ ...lawful(), 'response/response.json': responseJson({ status: 'blocked', stop: 'FLOW_UNDEFINED', reason: REASON, next: [] }) }, 'emits no plan', 'an undefined flow that still emitted a plan');
await expectError({ ...lawful(), 'response/response.json': responseJson({ next: ['git.publish'] }) }, 'which the Next table of uat.plan does not offer', 'a hand-off the Next table does not offer');

// Tiering: a journey the mission does not walk is planned secondary with its reason, and the plan says so.
const DEFERRED = { id: 'archive-item', kind: 'flow', goal: 'a viewer archives an item and it leaves the list', inputs: [], dependsOn: [], tier: 'secondary', deferral: { reason: 'no done-when line walks the archive' } };
const TIERED = [...UNITS, DEFERRED];
const TIERED_ROWS = { ...ROWS, 'archive-item': { entry: '`/items`', steps: 3, alias: 'viewer-archive', namespace: 'uat-archive-item' } };
await expectValid(lawful(TIERED, { rows: TIERED_ROWS }), 'a plan that defers one journey and says why');
await expectError(lawful(TIERED, { rows: TIERED_ROWS, tierCell: { 'archive-item': 'journey' } }), 'and the unit list says "secondary — no done-when line walks the archive"', 'a Flows row that hides a deferral the unit list carries');
await expectError(withUnits(lawful(TIERED, { rows: TIERED_ROWS }), unitsDoc([...UNITS, { ...DEFERRED, deferral: undefined }])), 'carries no deferral.reason', 'a flow deferred with no reason');
await expectError(withUnits(lawful(), unitsDoc([{ ...UNITS[0], deferral: { reason: 'x' } }, UNITS[1]])), 'is tier journey and carries a deferral', 'a journey flow that defers anything');

// An entry already open in the walk lane is covered or extended by this plan, never silently dropped.
const openLine = (unit, reason) => {
  const line = { product: 'sample-product', featureId: FEATURE, unit, state: null, lane: 'walk', tier: 'secondary', reason, recordedBy: 's-old/1/1', recordedAt: '2026-09-01T00:00:00.000Z', resolvedBy: null, resolvedAt: null };
  return { ...line, id: uncheckedId(line) };
};
await expectValid(lawful(TIERED, { rows: TIERED_ROWS }), 'a plan that extends the walk entry it already carried', { unchecked: [openLine('archive-item', 'no done-when line walks the archive')] });
await expectValid(lawful(), 'a plan that covers its open walk entry by tiering the flow back into the journey', { unchecked: [openLine('open-item', 'was deferred last time')] });
await expectError(lawful(), 'carries an open walk entry on unit archive-item', 'a plan that drops an open walk entry from its list', { unchecked: [openLine('archive-item', 'no done-when line walks the archive')] });

process.stdout.write('uat.plan self-test: one lawful plan, one tiered plan, two lawful stops and every mutation refused\n');
