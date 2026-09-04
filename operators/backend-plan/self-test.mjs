// Proves validate.mjs on a synthetic session branch: one lawful plan of two modules over a frozen
// contract of three operations, one gate stop, one MODULE_UNDEFINED stop with its reason, and one
// mutation per law, each of which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateBackendPlanStep } from './validate.mjs';

const OPERATOR = 'backend.plan';
const FEATURE = 'paid-access';
const HEAD = 'a'.repeat(40);
const DECISION = 'step-1/parallel-1/response/response.md';
const CONTRACT_OPS = ['enrol-course', 'cancel-enrolment', 'grant-access'];
const UNITS = [
  { id: 'enrolment', kind: 'module', goal: "a viewer's enrolment is created and cancelled inside the enrolment writer", inputs: [], dependsOn: [] },
  { id: 'access', kind: 'module', goal: 'paid access is granted from an enrolment through the access writer', inputs: [], dependsOn: ['enrolment'] },
];
const ROWS = {
  enrolment: { operations: ['enrol-course', 'cancel-enrolment'], stores: '`enrolments`', proofs: ['unit', 'integration'], migrations: '—' },
  access: { operations: ['grant-access'], stores: '`access`', proofs: ['unit', 'migration-replay'], migrations: '`migrations/grant-access`' },
};
const ORDER = [['access', ['enrolment']]];
const list = (ids) => ids.map((x) => `\`${x}\``).join(', ');
const unitsDoc = (units = UNITS, producedBy = OPERATOR) => ({ schemaVersion: 9, producedBy, units });
function receiptOf(units, { feature = FEATURE, rows = ROWS, order = ORDER, extraRows = [], goals = {} } = {}) {
  const moduleRows = [...units.map((u) => { const r = rows[u.id]; return `| \`${u.id}\` | ${goals[u.id] ?? u.goal} | ${list(r.operations)} | ${r.stores} | ${list(r.proofs)} | ${r.migrations} |`; }), ...extraRows].join('\n');
  const orderRows = order.map(([id, after]) => `| \`${id}\` | ${list(after)} |`).join('\n');
  return `# backend-plan — ${feature}

The frozen contract carries ${CONTRACT_OPS.length} operations; the plan groups them into ${units.length} modules.

## Modules

| Module | Goal | Operations | Stores | Proofs | Migrations |
| --- | --- | --- | --- | --- | --- |
${moduleRows}

## Order

| Module | After |
| --- | --- |
${orderRows}

## Fallbacks taken

| Code | Action |
| --- | --- |
`;
}
const stackModel = (operations = CONTRACT_OPS) => ({ decisionId: FEATURE, selectedAlternativeId: 'one', alternatives: [], boundaries: [], stores: [], components: [], operations: operations.map((operationId) => ({ operationId })) });
const requestJson = ({ featureId = FEATURE } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 2, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@workspaces/be', head: HEAD }],
  requirements: { featureId, resume: null },
  inputs: { 'architecture-decision': DECISION }, resume: null,
});
const responseJson = ({ status = 'done', stop, reason, fields = null, next = ['backend.generate'] } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 2, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks: [],
  fields: fields ?? { 'backend-plan': 'response/response.md', units: 'response/data/units.json' },
  ...(reason ? { reason } : {}), commits: [], next,
});

function writeBranch(files, contract = CONTRACT_OPS) {
  const session = mkdtempSync(path.join(tmpdir(), 'backend-plan-'));
  const producer = path.join(session, 'step-1', 'parallel-1', 'response');
  mkdirSync(path.join(producer, 'data'), { recursive: true });
  writeFileSync(path.join(producer, 'response.md'), `# architecture-decision — ${FEATURE}\n`);
  if (contract) writeFileSync(path.join(producer, 'data', 'stack-model.json'), JSON.stringify(stackModel(contract)));
  const branch = path.join(session, 'step-2', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'sample-product', startedAt: '2026-09-05T00:00:00Z', requestHashes: {}, chain: [['1/1'], ['2/1']], steps: { '1/1': 'architecture.decide', '2/1': OPERATOR }, current: '2/1', status: 'running' }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}
async function run(files, contract) {
  const { branch, session } = writeBranch(files, contract);
  const { errors } = await validateBackendPlanStep(branch);
  rmSync(session, { recursive: true, force: true });
  return errors;
}
async function expectValid(files, label, contract) { assert.deepEqual(await run(files, contract), [], `${label} should be valid`); }
async function expectError(files, needle, label, contract) {
  const errors = await run(files, contract);
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

const lawful = (units = UNITS, opts = {}) => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': receiptOf(units, opts),
  'response/data/units.json': unitsDoc(units),
});
const withUnits = (files, units) => ({ ...files, 'response/data/units.json': units });
const REASON = 'The contract carries revoke-access, whose writer resolves into no folder the source draws a boundary around and which shares its store with both modules.';
const rowsWith = (id, patch) => ({ ...ROWS, [id]: { ...ROWS[id], ...patch } });
const blocked = (stop, extra = {}) => ({ ...lawful(), 'response/response.json': responseJson({ status: 'blocked', stop, fields: {}, next: [], ...extra }), 'response/response.md': null, 'response/data/units.json': null });

await expectValid(lawful(), 'two modules that partition the contract, ordered');
await expectValid(lawful(), 'the same plan when the stack-model is not on disk', null);
await expectValid(blocked('INVALID_INPUT'), 'a gate stop with no plan');
await expectValid(blocked('MODULE_UNDEFINED', { reason: REASON }), 'an operation no module can take, named in its reason');

// One list: the Modules table and the unit list agree by id and goal.
await expectError(withUnits(lawful(), unitsDoc([UNITS[0]])), 'Modules row access has no entry', 'a Modules row without a unit');
await expectError(withUnits(lawful(), unitsDoc([...UNITS, { id: 'billing', kind: 'module', goal: 'invoices are issued', inputs: [], dependsOn: [] }])), 'unit billing has no Modules row', 'a unit without a Modules row');
await expectError(lawful(UNITS, { goals: { access: 'another goal' } }), 'Modules row access goal differs', 'a goal that differs between the table and the list');
await expectError(withUnits(lawful(), unitsDoc([UNITS[0], { ...UNITS[1], kind: 'table' }])), 'is a table; a unit of a backend plan is a module', 'a table planned as a module');
await expectError(withUnits(lawful(), unitsDoc([...UNITS, { ...UNITS[0] }])), 'is declared twice', 'a unit id declared twice');
await expectError(withUnits(lawful(), unitsDoc([UNITS[0], { ...UNITS[1], dependsOn: ['billing'] }])), 'depends on billing, which this file does not declare', 'a dependency on a module the plan does not name');
await expectError(withUnits(lawful(), unitsDoc(UNITS, 'interface.plan')), 'producedBy interface.plan is not backend.plan', 'a unit list another operator signed');
await expectError(withUnits(lawful(), unitsDoc([UNITS[0], { ...UNITS[1], goal: '' }])), 'goal', 'a module with no goal');
await expectError(lawful(UNITS, { extraRows: ['| `enrolment` | again | `enrol-course` | — | `unit` | — |'] }), 'Modules lists enrolment twice', 'a module listed twice');
await expectError({ ...lawful([], { order: [] }), 'response/data/units.json': unitsDoc([]) }, 'a plan with zero units is a stop', 'a done plan that names nothing');

// No two modules share an operation; the contract is partitioned, never widened; proofs are published kinds.
await expectError(lawful(UNITS, { rows: rowsWith('access', { operations: ['grant-access', 'enrol-course'] }) }), 'share the operation enrol-course', 'one operation in two modules');
await expectError(lawful(UNITS, { rows: rowsWith('access', { operations: ['grant-access', 'grant-access'] }) }), 'lists the operation grant-access twice', 'one operation listed twice in one module');
await expectError(lawful(UNITS, { rows: rowsWith('enrolment', { operations: ['enrol-course'] }) }), 'operation cancel-enrolment of the contract belongs to no module', 'a contract operation left out');
await expectError(lawful(UNITS, { rows: rowsWith('access', { operations: ['grant-access', 'revoke-access'] }) }), 'names the operation revoke-access, which the contract does not carry', 'a module that widens the contract');
await expectError(lawful(UNITS, { rows: rowsWith('access', { proofs: ['unit', 'screenshot'] }) }), 'names the proof kind screenshot, which templates/kinds/proof.schema.json does not publish', 'a proof kind the tree does not publish');
await expectError(lawful(UNITS, { rows: rowsWith('access', { proofs: [] }) }), 'cell Proofs', 'a module with no proof');

// The Order table and dependsOn say the same thing.
await expectError(lawful(UNITS, { order: [] }), 'Order says access runs after nothing, response/data/units.json says enrolment', 'a dependency the Order table omits');
await expectError(lawful(UNITS, { order: [['access', ['enrolment']], ['enrolment', ['access']]] }), 'Order says enrolment runs after access, response/data/units.json says nothing', 'an order dependsOn does not carry');
await expectError(lawful(UNITS, { order: [['access', ['billing']]] }), 'Order puts access after billing, which Modules does not name', 'an order after a module the plan does not name');
await expectError(lawful(UNITS, { order: [['access', ['enrolment']], ['billing', ['enrolment']]] }), 'Order names billing, which Modules does not', 'an order row for a module the plan does not name');

// Title, gate and stop shape.
await expectError({ ...lawful(), 'request/request.json': requestJson({ featureId: 'billing' }) }, 'the request names featureId billing', 'a plan titled by another feature');
await expectError(blocked('MODULE_UNDEFINED'), 'carries a reason naming the operation', 'an undefined module with no reason');
await expectError(blocked('MODULE_UNDEFINED', { reason: 'two operations:\nrevoke-access\nexpire-access' }), 'spans more than one paragraph', 'a reason in several paragraphs');
await expectError({ ...lawful(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MODULE_UNDEFINED', reason: REASON, next: [] }) }, 'emits no plan', 'an undefined module that still emitted a plan');
await expectError({ ...lawful(), 'response/response.json': responseJson({ next: ['git.publish'] }) }, 'which the Next table of backend.plan does not offer', 'a hand-off the Next table does not offer');

process.stdout.write('backend.plan self-test: one lawful plan, two lawful stops and every mutation refused\n');
