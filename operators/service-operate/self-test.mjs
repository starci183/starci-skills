// Proves validate.mjs on synthetic session branches beside a synthetic host: one lawful up, one
// lawful down, one lawful attestation, the three lawful stops, and one mutation per law, each of
// which must fail with a line that names the defect. The host root carries its own environment
// declaration with three declared services — one the environment wants up, one it wants down, one it
// keeps with a person — so the test reads no stack of the machine it runs on.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateServiceStep } from './validate.mjs';
import { loadEnvironmentSchema, stackDeclaration } from '../../scripts/validate-request.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OPERATOR = 'service.operate';
const ENV = 'sample-env';
const PROJECT = 'sample-product';

const host = mkdtempSync(path.join(tmpdir(), 'service-host-'));
mkdirSync(path.join(host, '.stacks', ENV), { recursive: true });
writeFileSync(path.join(host, '.stacks', ENV, 'environment.json'), JSON.stringify({
  schemaVersion: 9,
  env: ENV,
  production: false,
  services: [
    { id: 'metrics', kind: 'observability', desired: 'up', command: 'command-ref://stacks/metrics', probe: { url: 'http://127.0.0.1:9000/health' }, holder: 'declared', publicPort: 9000 },
    { id: 'edge-tunnel', kind: 'tunnel', desired: 'down', command: 'command-ref://stacks/tunnel', probe: { port: 7000 }, holder: 'declared' },
    { id: 'console', kind: 'other', desired: 'up', command: 'command-ref://stacks/console', probe: { port: 9100 }, holder: 'person' },
  ],
}, null, 2));
const envSchema = await loadEnvironmentSchema(ROOT);
const declaration = await stackDeclaration(ROOT, ENV, host, envSchema);
assert.deepEqual(declaration.errors, [], 'the synthetic declaration passes its schema');
assert.equal(declaration.authorization.service, 'declared', 'a non-production environment answers the service class by declaration');
const APPROVAL = declaration.reference;

const UP_CHECKS = [
  ['service-declared', 'passed', 'the declaration names this service with its kind, command, probe and holder'],
  ['command-run', 'passed', 'the declared command ref was run once and returned 0'],
  ['probe-answered', 'passed', 'the declared endpoint answered 200'],
  ['holder-recorded', 'passed', 'the process tree of pid 4242 answers on the declared port'],
];
const DOWN_CHECKS = [
  ['service-declared', 'passed', 'the declaration names this service with its kind, command, probe and holder'],
  ['command-run', 'passed', 'the declared command ref was run once and returned 0'],
  ['port-free', 'passed', 'connecting to the declared port is refused'],
];
function receiptOf({ service = 'metrics', kind = 'observability', desired = 'up', observed = 'up', endpoint = '`http://127.0.0.1:9000/health`', holder = '4242', approval = APPROVAL, checks = UP_CHECKS, findings = [], fallbacks = [], env = ENV } = {}) {
  const rows = checks.map(([c, s, e]) => `| \`${c}\` | ${s} | ${e} |`).join('\n');
  const findingRows = findings.map(([c, s]) => `| \`${c}\` | ${s} |`).join('\n');
  const fallbackRows = fallbacks.map(([c, a]) => `| \`${c}\` | ${a} |`).join('\n');
  return `# service-receipt — ${service}

The ${kind} service of ${env} was asked for ${desired} and its own probe answered ${observed}.

## Binding

| Field | Value |
| --- | --- |
| Operator | \`${OPERATOR}\` |
| Step | \`step-1/parallel-1\` |
| Environment | ${env} |
| Service | \`${service}\` |
| Kind | ${kind} |
| Desired | ${desired} |
| Observed | ${observed} |
| Endpoint | ${endpoint} |
| Holder | ${holder} |
| Approval | \`${approval}\` |

## Checks

| Check | Status | Evidence |
| --- | --- | --- |
${rows}

## Fallbacks taken

| Code | Action |
| --- | --- |
${fallbackRows}${fallbackRows ? '\n' : ''}
## Findings

| Code | Statement |
| --- | --- |
${findingRows}${findingRows ? '\n' : ''}`;
}
const requestJson = ({ service = 'metrics', env = ENV, desired = 'up', approval = APPROVAL } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@worktrees/sessions/central-runtime', head: null }, { alias: `@workspaces/ports/${PROJECT}`, head: null }, { alias: '@workspaces/device-state', head: null }],
  requirements: { service, env, desired, approval, resume: null },
  inputs: {}, resume: null,
});
const responseJson = ({ status = 'done', stop, reason, fields = null, next = ['quality.verify'], fallbacks = [] } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 1, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks,
  fields: fields ?? { 'service-receipt': 'response/response.md' },
  ...(reason ? { reason } : {}), commits: [], next,
});

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'service-session-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: PROJECT, startedAt: '2026-09-05T00:00:00Z', requestHashes: {}, chain: [['1/1']], steps: { '1/1': OPERATOR }, current: '1/1', status: 'running' }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}
async function run(files) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateServiceStep(branch, ROOT, host);
  rmSync(session, { recursive: true, force: true });
  return errors;
}
async function expectValid(files, label) { assert.deepEqual(await run(files), [], `${label} should be valid`); }
async function expectError(files, needle, label) {
  const errors = await run(files);
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

const lawfulUp = (receipt = {}, request = {}, response = {}) => ({
  'request/request.json': requestJson(request),
  'response/response.json': responseJson(response),
  'response/response.md': receiptOf(receipt),
});
const DOWN = {
  request: { service: 'edge-tunnel', desired: 'down' },
  receipt: { service: 'edge-tunnel', kind: 'tunnel', desired: 'down', observed: 'down', endpoint: 'port 7000', holder: '—', checks: DOWN_CHECKS },
};
const lawfulDown = (patch = {}) => ({
  'request/request.json': requestJson(DOWN.request),
  'response/response.json': responseJson({ next: ['user'] }),
  'response/response.md': receiptOf({ ...DOWN.receipt, ...patch }),
});
const attested = (patch = {}) => ({
  'request/request.json': requestJson({ desired: 'attested' }),
  'response/response.json': responseJson({ next: ['environment.preflight'] }),
  'response/response.md': receiptOf({ desired: 'attested', checks: UP_CHECKS.filter(([c]) => c !== 'command-run'), findings: [['SERVICE_OBSERVED_ONLY', 'nothing was run; the receipt records what the probe found']], ...patch }),
});
const blocked = (stop, extra = {}) => ({
  'request/request.json': requestJson(extra.request ?? {}),
  'response/response.json': responseJson({ status: 'blocked', stop, fields: {}, next: [], ...extra.response }),
  'response/response.md': null,
});

// The lawful branches.
await expectValid(lawfulUp(), 'a service brought up and proved by its own probe');
await expectValid(lawfulDown(), 'a service taken down with its port proved free');
await expectValid(attested(), 'an attestation that ran nothing and reported the probe');
await expectValid(lawfulUp({ checks: UP_CHECKS.filter(([c]) => c !== 'command-run'), findings: [['SERVICE_ALREADY_IN_STATE', 'the service already stood up; the declared command was not run']] }), 'a service already standing in the desired state');
await expectValid(blocked('INVALID_INPUT'), 'a gate stop with no receipt');
await expectValid(blocked('NO_PROGRESS'), 'a re-entry that changed nothing');
await expectValid(blocked('SERVICE_UNPROVEN', { response: { reason: 'metrics was asked for up and the declared endpoint http://127.0.0.1:9000/health answered nothing; the state is not proved and the receipt asserts none.' } }), 'an up whose probe never answered');
await expectValid(blocked('SERVICE_APPROVAL_REQUIRED', { request: { service: 'console' }, response: { reason: 'console is declared holder person; nothing was started.' } }), 'a service the environment keeps with a person');

// The declaration is the authority on which services exist and what they are.
await expectError(lawfulUp({}, { service: 'no-such-service' }), 'is not one the declaration', 'a service the declaration does not carry');
await expectError(lawfulUp({ service: 'edge-tunnel' }), "Service edge-tunnel differs from the request's metrics", 'a receipt about another service');
await expectError(lawfulUp({ kind: 'sonar' }), 'differs from the observability the declaration gives service metrics', 'a kind the declaration does not give');
await expectError(lawfulUp({ desired: 'down', observed: 'down', checks: DOWN_CHECKS }), "Desired down differs from the request's up", 'a desired state the request never asked for');
await expectError(lawfulUp({ env: 'other-env' }), "Environment other-env differs from the request's", 'a receipt bound to another environment');
await expectError({ ...lawfulUp(), 'response/response.md': receiptOf().replace('# service-receipt — metrics', '# service-receipt — edge-tunnel') }, 'title names edge-tunnel', 'a receipt titled by another service');

// A state nobody probed is not a state.
await expectError(lawfulUp({ checks: UP_CHECKS.filter(([c]) => c !== 'probe-answered') }), 'check probe-answered is absent or failed', 'an up observed without its probe');
await expectError(lawfulUp({ checks: UP_CHECKS.map((r) => (r[0] === 'probe-answered' ? [r[0], 'failed', r[2]] : r)) }), 'a failed check is the stop SERVICE_UNPROVEN', 'a failed check on a receipt');
await expectError(lawfulUp({ checks: UP_CHECKS.filter(([c]) => c !== 'holder-recorded') }), 'check holder-recorded is absent or failed', 'an up whose holder was never recorded');
await expectError(lawfulUp({ holder: 'the metrics container' }), 'is not the pid that answers', 'an up whose holder is a name and not a pid');
await expectError(lawfulUp({ checks: [...UP_CHECKS, ['port-free', 'passed', 'nothing answers']] }), 'check port-free is recorded while Observed is up', 'an up that also claims its port is free');
await expectError(lawfulDown({ checks: DOWN_CHECKS.filter(([c]) => c !== 'port-free') }), 'check port-free is absent or failed', 'a down whose port was never proved free');
await expectError(lawfulDown({ checks: [...DOWN_CHECKS, ['probe-answered', 'passed', 'the port answered']] }), 'is not a service that is down', 'a down whose probe answered');
await expectError(lawfulDown({ holder: '4242' }), 'is recorded while Observed is down', 'a down that still claims a holder');
await expectError(lawfulUp({ observed: 'standing' }), 'is neither up nor down', 'an observed state outside the two');
await expectError(lawfulUp({ observed: 'down', checks: DOWN_CHECKS }), 'a service that did not reach the state asked for', 'a done branch that reached the other state');

// What a move owes, and what an attestation may not do.
await expectError(attested({ checks: UP_CHECKS }), 'attesting reads the probe and runs nothing', 'an attestation that ran the declared command');
await expectError(lawfulUp({ checks: UP_CHECKS.filter(([c]) => c !== 'command-run') }), 'no command-run check and no SERVICE_ALREADY_IN_STATE finding', 'a move that recorded neither a command nor a no-op');
await expectError(lawfulUp({ findings: [['SERVICE_ALREADY_IN_STATE', 'it already stood up']] }), 'is a proved no-op and the declared command is not run', 'a no-op that also ran the command');

// Authority.
await expectError({ ...lawfulUp({ service: 'console', kind: 'other', endpoint: 'port 9100' }, { service: 'console' }) }, 'is declared holder person', 'a person-held service brought up anyway');
await expectError(blocked('SERVICE_APPROVAL_REQUIRED', { response: { reason: 'metrics needs a person.' } }), 'the environment answered this one', 'an approval stop the declaration already answered');
await expectError(lawfulUp({ approval: `.stacks/${ENV}/environment.json#sha256:${'0'.repeat(64)}` }, { approval: `.stacks/${ENV}/environment.json#sha256:${'0'.repeat(64)}` }), 'which is not the declaration on disk', 'an approval naming a declaration that moved');

// The stop shape, and the credential sweep.
await expectError({ ...lawfulUp(), 'response/response.json': responseJson({ status: 'blocked', stop: 'SERVICE_UNPROVEN', reason: 'metrics never answered.' }) }, 'emits no response/response.md', 'a stop that still emitted a receipt');
await expectError(blocked('SERVICE_UNPROVEN'), 'carries a reason naming the service', 'an unproven state with no reason');
await expectError(blocked('SERVICE_UNPROVEN', { response: { reason: 'the probe:\nnever answered' } }), 'spans more than one paragraph', 'a reason in several paragraphs');
await expectError(blocked('SERVICE_UNPROVEN', { response: { reason: 'the declared endpoint answered nothing.' } }), 'reason does not name service metrics', 'a reason that never names the service');
await expectError(lawfulUp({ checks: UP_CHECKS.map((r) => (r[0] === 'command-run' ? [r[0], 'passed', 'ran with password: hunter2seven'] : r)) }), 'carries a credential-shaped value', 'a receipt that printed the command credential');
await expectError({ ...lawfulUp(), 'response/response.json': responseJson({ next: ['git.publish'] }) }, 'which the Next table of service.operate does not offer', 'a hand-off the Next table does not offer');
await expectError({ ...lawfulUp(), 'request/request.json': requestJson({ env: 'no-such-env' }) }, 'names no stack', 'an env with no stack folder');

rmSync(host, { recursive: true, force: true });
process.stdout.write('service.operate self-test: four lawful receipts, four lawful stops and every mutation refused\n');
