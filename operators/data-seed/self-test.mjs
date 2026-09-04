// Proves validate.mjs on a synthetic session branch: one seed placed at volume under the flow's account
// and prefix, one drafted from the template, one rolled back, one refused on a shared row, one blocked
// on a missing account, and one mutation per law, each of which must fail with a line that names the
// defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateSeedStep, SEED_CHECKS } from './validate.mjs';

const OPERATOR = 'data.seed';
const FLOW = 'paid-enrolment';
const ENTRY = 'demo-product/be';
const ENV = 'dev';
const APPROVAL = '@worktrees/debts/be.md#seed-approval';
const NS = `uat-${FLOW}`;
const ACCOUNT = `uat-${FLOW}-learner`;
const FINGERPRINT = `sha256:${'5'.repeat(64)}`;

const RECORDS = [
  [`${NS}-course-1`, 'courses', 'prefix', 'yes'],
  [`${NS}-course-2`, 'courses', 'prefix', 'yes'],
  [`enrolment:${ACCOUNT}`, 'enrolments', 'owner', 'yes'],
];
const check = (name, status = 'passed') => [name, status, `probes/${name}.json`];
function receipt({ operation = 'apply', records = RECORDS, checks = SEED_CHECKS.map((n) => check(n)), findings = [['SEED_ALREADY_APPLIED', 'the rows already stood under this namespace; placing them again changed nothing']], drafted = 'no', flow = FLOW, env = ENV, route = ENTRY, approval = APPROVAL, namespace = NS, account = ACCOUNT, operator = OPERATOR, fingerprint = FINGERPRINT } = {}) {
  return `# seed-receipt — ${flow}

The flow's seed was placed against its provisioned account at the flow's representative volume, and
the rollback set names exactly the rows placed.

## Binding

| Field | Value |
| --- | --- |
| Operator | \`${operator}\` |
| Step | \`step-1/parallel-1\` |
| Flow | \`${flow}\` |
| Environment | \`${env}\` |
| Route | \`${route}\` |
| Account | \`${account}\` |
| Operation | ${operation} |
| Approval | ${approval} |
| Namespace | \`${namespace}\` |
| Seed fingerprint | \`${fingerprint}\` |
| Drafted | ${drafted} |

## Records

| Id | Store | Attribution | Rollback |
| --- | --- | --- | --- |
${records.map(([id, store, attribution, rollback]) => `| \`${id}\` | \`${store}\` | ${attribution} | ${rollback} |`).join('\n')}

## Checks

| Check | Status | Evidence |
| --- | --- | --- |
${checks.map(([name, status, evidence]) => `| \`${name}\` | ${status} | \`${evidence}\` |`).join('\n')}

## Findings

| Code | Statement |
| --- | --- |
${findings.map(([code, statement]) => `| \`${code}\` | ${statement} |`).join('\n')}
`;
}
const requestJson = ({ flow = FLOW, routeKey = ENTRY, env = ENV, approval = APPROVAL, operation = 'apply', extra = {} } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: `@worktrees/uat/${flow}`, head: null }, { alias: '@worktrees/sessions/central-runtime', head: null }, { alias: '@workspaces/device-state', head: null }],
  requirements: { flow, routeKey, env, approval, operation, resume: null, ...extra },
  inputs: {}, resume: null,
});
const responseJson = ({ status = 'done', stop, next = ['uat.verify'], withReceipt = status === 'done' } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, status, ...(stop ? { stop } : {}),
  fallbacks: [], fields: withReceipt ? { 'seed-receipt': 'response/response.md' } : {}, commits: [], next,
});

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'seed-session-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'demo-product', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': OPERATOR }, current: '1/1', status: 'running' }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}
async function expectValid(files, label, options = {}) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateSeedStep(branch, undefined, options);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label, options = {}) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateSeedStep(branch, undefined, options);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

const applied = (over = {}) => ({ 'request/request.json': requestJson(), 'response/response.json': responseJson(), 'response/response.md': receipt(), ...over });
const drafted = () => applied({ 'response/response.md': receipt({ drafted: 'yes', findings: [['SEED_DRAFTED', 'the flow had no seed directory, so one was drafted from the template and the flow document']] }) });
const rolledBack = () => applied({ 'request/request.json': requestJson({ operation: 'rollback' }), 'response/response.md': receipt({ operation: 'rollback', findings: [['SEED_ROLLED_BACK', 'the rollback set was removed and no other row']] }) });
const limited = () => applied({ 'response/response.md': receipt({ records: [...RECORDS, ['setting:theme', 'settings', 'limitation', 'yes']], findings: [['SEED_LIMITATION', 'the settings store has neither an owner column nor a prefixable identifier; its one row is removed by this seed and cannot be told from another session\'s']] }) });
const sharedRow = () => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson({ status: 'blocked', stop: 'SEED_SHARED_ROW', next: [], withReceipt: true }),
  'response/response.md': receipt({ records: [], checks: [check('store-reachable'), check('rows-attributable', 'failed')], findings: [['SHARED_ROW_REFUSED', 'course-1 already stands in courses outside the flow namespace; nothing was written']] }),
});
const failing = (name, stop) => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson({ status: 'blocked', stop, next: [], withReceipt: true }),
  'response/response.md': receipt({ checks: SEED_CHECKS.map((n) => check(n, n === name ? 'failed' : 'passed')), findings: [] }),
});

await expectValid(applied(), 'a seed placed at volume under the flow account and prefix');
await expectValid(drafted(), 'a seed drafted from the template and placed in the same branch');
await expectValid(rolledBack(), 'the rollback set removed and nothing else');
await expectValid(limited(), 'a store with neither owner column nor prefix recorded as a limitation, never as a schema change');
await expectValid(sharedRow(), 'a record that would land on a shared row refused before anything was written');
await expectValid({ 'request/request.json': requestJson(), 'response/response.json': responseJson({ status: 'blocked', stop: 'IDENTITY_MISSING', next: ['identity.provision'] }) }, 'a flow with no account yet handed to provisioning');
await expectValid(failing('store-reachable', 'PROVISIONING_UNAVAILABLE'), 'a store that cannot be reached');
await expectValid(failing('expected-state', 'SEED_UNPROVEN'), 'a seed whose state differs from its expectation');

// The request gate.
await expectError(applied({ 'request/request.json': requestJson({ flow: null }) }), 'required field flow has no value', 'a seed for no flow');
await expectError(applied({ 'request/request.json': requestJson({ approval: null }) }), 'required field approval has no value', 'a seed nobody approved');
await expectError(applied({ 'request/request.json': requestJson({ extra: { desiredState: {} } }) }), 'requirements.desiredState is not a field', 'the retired platform declaration');
await expectError(applied({ 'request/request.json': requestJson({ routeKey: 'demo-product' }) }), 'is not a <project>/<role> registry entry', 'a route key that names no route');
await expectError(applied({ 'request/request.json': requestJson({ operation: 'purge' }) }), 'is neither apply nor rollback', 'an operation the seed does not know');
await expectError(applied({ 'request/request.json': requestJson({ env: 'no-such-stack' }) }), 'which this installation does not have', 'an env with no stack');
await expectError(applied({ 'request/request.json': requestJson({ extra: { operation: 'apply', flow: `${FLOW}` }, approval: 'password: hunter2-hunter2' }) }), 'carries a credential-shaped value', 'a credential where a name belongs');

// The receipt binds the request.
await expectError(applied({ 'response/response.md': receipt({ operator: 'platform.operate' }) }), 'this receipt is written by data.seed', 'a receipt signed by the retired operator');
await expectError(applied({ 'response/response.md': receipt({ flow: 'other-flow' }) }), 'Flow other-flow differs', 'a receipt for another flow');
await expectError(applied({ 'response/response.md': receipt({ env: 'staging' }) }), 'a seed of one stack is not a seed in another', 'a receipt for another environment');
await expectError(applied({ 'response/response.md': receipt({ route: 'demo-product/fe' }) }), 'Route demo-product/fe differs', 'a receipt for another route');
await expectError(applied({ 'response/response.md': receipt({ operation: 'rollback' }) }), 'Operation rollback differs', 'a receipt for another operation');
await expectError(applied({ 'response/response.md': receipt({ approval: 'someone-elses' }) }), 'names an approval the request did not declare', 'an approval borrowed from another seed');
await expectError(applied({ 'response/response.md': receipt({ namespace: 'uat-other-flow' }) }), 'does not carry the flow', 'a namespace of another flow');
await expectError(applied({ 'response/response.md': receipt({ namespace: 'shared' }) }), 'is not a uat- prefix', 'a namespace nothing can be told apart by');
await expectError(applied({ 'response/response.md': receipt({ account: 'admin' }) }), 'is not a provisioned uat- username', 'rows owned by an account the flow never provisioned');
await expectError(applied({ 'response/response.md': receipt({ fingerprint: 'latest' }) }), 'is not a sha256 digest', 'a seed fingerprint nothing can freeze');

// Attribution, rollback and drafts.
await expectError(applied({ 'response/response.md': receipt({ records: [['course-1', 'courses', 'prefix', 'yes']] }) }), 'does not carry the namespace', 'a prefix row without the prefix');
await expectError(applied({ 'response/response.md': receipt({ records: [...RECORDS, ['setting:theme', 'settings', 'limitation', 'yes']] }) }), 'does not record SEED_LIMITATION', 'a limitation the receipt never names');
await expectError(applied({ 'response/response.md': receipt({ records: [...RECORDS, ['setting:theme', 'settings', 'limitation', 'no']], findings: [['SEED_LIMITATION', 'x']] }) }), 'is not in the rollback set', 'a limitation row left behind');
await expectError(applied({ 'response/response.md': receipt({ findings: [['SEED_LIMITATION', 'x']] }) }), 'while every record is attributed by owner or prefix', 'a limitation recorded where none exists');
await expectError(applied({ 'response/response.md': receipt({ records: [...RECORDS, RECORDS[0]] }) }), 'is listed twice', 'a record listed twice');
await expectError(applied({ 'response/response.md': receipt({ records: [] }) }), 'lists the rows it placed, and this receipt lists none', 'a placed seed with no rows');
await expectError(applied({ 'request/request.json': requestJson({ operation: 'rollback' }), 'response/response.md': receipt({ operation: 'rollback', records: [[`${NS}-course-1`, 'courses', 'prefix', 'no']], findings: [['SEED_ROLLED_BACK', 'x']] }) }), 'stays after a rollback', 'a rollback that left a row');
await expectError(applied({ 'request/request.json': requestJson({ operation: 'rollback' }), 'response/response.md': receipt({ operation: 'rollback' }) }), 'a rollback records SEED_ROLLED_BACK', 'a rollback the receipt never names');
await expectError(applied({ 'response/response.md': receipt({ findings: [['SEED_ROLLED_BACK', 'x']] }) }), 'SEED_ROLLED_BACK is recorded under operation apply', 'an application that claims a rollback');
await expectError(applied({ 'response/response.md': receipt({ drafted: 'yes' }) }), 'does not record SEED_DRAFTED', 'a draft the receipt never names');
await expectError(applied({ 'response/response.md': receipt({ findings: [['SEED_DRAFTED', 'x']] }) }), 'SEED_DRAFTED is recorded while Drafted says no', 'a draft claimed for a committed seed');

// Shared rows and checks.
await expectError(applied({ 'response/response.md': receipt({ findings: [['SHARED_ROW_REFUSED', 'x']] }) }), 'stops the branch with SEED_SHARED_ROW', 'a refused row on a placed outcome');
await expectError({ ...sharedRow(), 'response/response.md': receipt({ records: [], checks: [check('store-reachable')], findings: [] }) }, 'does not record SHARED_ROW_REFUSED', 'a shared-row stop the receipt never names');
await expectError(applied({ 'response/response.md': receipt({ checks: SEED_CHECKS.slice(0, 3).map((n) => check(n)) }) }), 'cannot be proved without the rollback-listed check', 'a narrowed proof set');
await expectError(applied({ 'response/response.md': receipt({ checks: SEED_CHECKS.map((n) => check(n, n === 'expected-state' ? 'failed' : 'passed')) }) }), 'cannot be reported as placed', 'a placed outcome over a failed check');
await expectError(failing('expected-state', 'PROVISIONING_UNAVAILABLE'), 'stops with SEED_UNPROVEN, not PROVISIONING_UNAVAILABLE', 'an unproved seed reported as an unreachable store');
await expectError(applied({ 'response/response.md': receipt({ checks: [...SEED_CHECKS.map((n) => check(n)), ['rows-deleted', 'passed', 'x']] }) }), 'row 5 cell Check', 'a check the kind does not publish');
await expectError(applied({ 'response/response.md': receipt().replace('## Records', '## Rows') }), 'missing section ^## Records$', 'receipt section renamed');
await expectError(applied({ 'response/response.md': receipt({ findings: [['SEED_ALREADY_APPLIED', 'password: hunter2-hunter2 was used']] }) }), 'carries a credential-shaped value', 'a credential in the receipt');
await expectError(applied({ 'response/response.json': responseJson({ withReceipt: false }) }), 'required output seed-receipt is not in fields', 'a done branch with no receipt');

// Authority from the environment's own declaration: the seed class is declared in a non-production
// environment and a person's in production.
const HOST = mkdtempSync(path.join(tmpdir(), 'seed-host-'));
const declare = (env, body) => {
  mkdirSync(path.join(HOST, '.stacks', env), { recursive: true });
  const bytes = Buffer.from(JSON.stringify(body, null, 2));
  writeFileSync(path.join(HOST, '.stacks', env, 'environment.json'), bytes);
  return `.stacks/${env}/environment.json#sha256:${createHash('sha256').update(bytes).digest('hex')}`;
};
const DEV_REF = declare('dev', { schemaVersion: 9, env: 'dev', production: false });
const PROD_REF = declare('production', { schemaVersion: 9, env: 'production', production: true });
const onHost = { hostRoot: HOST };
const declared = ({ approval = DEV_REF, env = 'dev' } = {}) => applied({ 'request/request.json': requestJson({ approval, env }), 'response/response.md': receipt({ approval, env }) });
await expectValid(declared(), 'a dev seed approved by the environment declaration itself, no person asked', onHost);
await expectError(declared({ approval: PROD_REF, env: 'production' }), 'marks seed as person', 'a declaration reference for a production seed, which the production defaults keep with a person', onHost);
await expectError(declared({ approval: DEV_REF.replace(/[0-9a-f]{64}$/, '9'.repeat(64)) }), 'the declaration moved since it was read', 'a declaration reference whose hash no longer matches the file', onHost);
rmSync(HOST, { recursive: true, force: true });

process.stdout.write('data.seed self-test: 9 valid branches, 39 rejected mutations\n');
