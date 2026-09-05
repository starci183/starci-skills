// Proves validate.mjs on a synthetic session branch: one lawful walk whose three lanes pass and whose
// record is appended, one lawful walk blocked on a case the runner reported failing, and one mutation
// per law — a case the runner never printed, a record written outside the run namespace, a record that
// names no served head, a credential where a name belongs — each of which must fail with a line that
// names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateApiStep, LANES } from './validate.mjs';

const OPERATOR = 'api.verify';
const FLOW = 'paid-enrolment';
const ENV = 'dev';
const COMMIT = '1'.repeat(40);
const SERVED = '2'.repeat(40);
const RUN = `20260105-101500-${COMMIT.slice(0, 7)}`;
const NS = `uat-${RUN}`;
const ENDPOINT = 'http://127.0.0.1:3001/graphql';
const COMMAND = 'npm run test:e2e';
const OUTPUT_REF = 'response/artifacts/api-output.txt';
const RECEIPT = 'step-1/parallel-1/response/response.md';

// The host is the self-test's own: a stack lookup must not depend on where this checkout sits.
const HOST = mkdtempSync(path.join(tmpdir(), 'api-host-'));
mkdirSync(path.join(HOST, '.stacks', ENV), { recursive: true });
const DECLARATION = Buffer.from(JSON.stringify({ schemaVersion: 9, env: ENV, production: false }, null, 2));
writeFileSync(path.join(HOST, '.stacks', ENV, 'environment.json'), DECLARATION);
const APPROVAL = `.stacks/${ENV}/environment.json#sha256:${createHash('sha256').update(DECLARATION).digest('hex')}`;
const onHost = { hostRoot: HOST };

const CASES = [
  { caseId: 'enrolment creates a paid enrolment', request: 'POST /graphql createEnrolment', status: 'pass', assertion: 'the enrolment is returned in the paid state', durationMs: 412, evidenceRef: `${OUTPUT_REF}#L41` },
  { caseId: 'enrolment refuses a second enrolment', request: 'POST /graphql createEnrolment', status: 'pass', assertion: 'the second attempt is refused with a conflict', durationMs: 118, evidenceRef: `${OUTPUT_REF}#L58` },
];
const RECORDS = [{ id: `${NS}-enrolment-1`, store: 'enrolments', inNamespace: true, readBackRef: 'GET /graphql enrolment(id:)' }];

const casesJson = ({ cases = CASES, servedHead = SERVED, contains = true, exitCode = 0, namespace = NS, runId = RUN, commit = COMMIT, flow = FLOW, command = COMMAND, outputRef = OUTPUT_REF } = {}) => ({
  runId, flow, commit, servedHead, servedContainsCommit: contains, receiptRef: RECEIPT, endpoint: ENDPOINT,
  command, commandRef: 'the route gate plan, entry e2e', exitCode, outputRef, namespace,
  account: { alias: 'learner', username: `uat-${FLOW}-learner`, credentialName: 'uat-shared', credentialRef: `.stacks/${ENV}/secrets/uat.enc`, plaintextRecorded: false },
  startedAt: '2026-01-05T10:15:00Z', cases,
});
const verdictsJson = ({ lanes = LANES.map((lane) => ({ lane, verdict: 'pass', evidenceRefs: ['response/data/cases.json'], statement: `the ${lane} lane holds on the runner's own record` })), records = RECORDS, namespace = NS, flowRoot = null, runId = RUN, commit = COMMIT, servedHead = SERVED, performed = true } = {}) => ({
  runId, commit, servedHead, namespace, flowRoot: flowRoot ?? '/nowhere-this-machine-has',
  resultRef: `.worktrees/e2e/${FLOW}/runs/${runId}/result.json`,
  latestRef: `.worktrees/e2e/${FLOW}/latest.json`,
  historyRef: `.worktrees/e2e/${FLOW}/history.md`,
  lanes, records,
  cleanup: { performed, verifiedReadOnly: true, namespace, runRecordsDeleted: false },
});

function receipt({ cases = CASES, lanes = LANES.map((lane) => [lane, 'pass']), records = RECORDS, servedHead = SERVED, exitCode = 0, namespace = NS, runId = RUN, flow = FLOW, approval = APPROVAL, env = ENV, command = COMMAND, findings = [] } = {}) {
  return `# api-verification — ${flow}

The suite the route's gate plan declares was run as a client against the attested entry, on the rows
the seed placed, and the three lanes were judged apart on the runner's own record.

## Binding

| Field | Value |
| --- | --- |
| Run | \`${runId}\` |
| Approval | \`${approval}\` |
| Flow | \`${flow}\` |
| Environment | ${env} |
| Pinned commit | \`${COMMIT}\` |
| Served head | \`${servedHead}\` |
| Served contains pinned | yes |
| Endpoint | \`${ENDPOINT}\` |
| Namespace | \`${namespace}\` |
| Account | \`learner\` |
| Credential | \`.stacks/${env}/secrets/uat.enc\`, resolved by name where the suite consumes it |
| Command | \`${command}\` |
| Command source | the route gate plan, entry e2e |
| Exit code | ${exitCode} |
| Run record | \`.worktrees/e2e/${flow}/runs/${runId}/result.json\` |
| Latest | \`${runId}\` |

## Cases

| Case | Request | Status | Assertion | Duration | Evidence |
| --- | --- | --- | --- | --- | --- |
${cases.map((c) => `| \`${c.caseId}\` | \`${c.request}\` | ${c.status} | ${c.assertion} | ${c.durationMs}ms | \`${c.evidenceRef}\` |`).join('\n')}

## Lanes

| Lane | Verdict | Evidence |
| --- | --- | --- |
${lanes.map(([lane, verdict]) => `| \`${lane}\` | ${verdict} | \`response/data/cases.json\` |`).join('\n')}

## Namespace

| Record | Store | Inside | Read back |
| --- | --- | --- | --- |
${records.map((r) => `| \`${r.id}\` | \`${r.store}\` | ${r.inNamespace ? 'yes' : 'no'} | \`${r.readBackRef}\` |`).join('\n')}

## Printed

| Artifact | Why |
| --- | --- |
| \`response/data/cases.json\` | the per-case results, printed before the lanes were published |

## Findings

| Code | Statement |
| --- | --- |
${findings.map(([code, statement]) => `| \`${code}\` | ${statement} |`).join('\n')}

## Fallbacks taken

| Code | Action |
| --- | --- |
`;
}

const runnerOutput = (cases = CASES) => `> ${COMMAND}\n\n${cases.map((c, i) => `  ok ${i + 1} ${c.caseId} (${c.durationMs}ms)`).join('\n')}\n\ndone\n`;

const requestJson = ({ flow = FLOW, env = ENV, approval = APPROVAL, runId = RUN, inputs = { 'platform-operation-receipt': RECEIPT }, extra = {} } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 2, parallel: 1, sessionId: 's-test',
  contexts: [
    { alias: `@worktrees/e2e/${flow}`, head: null },
    { alias: '@worktrees/sessions/central-runtime', head: null },
    { alias: '@workspaces/device-state', head: null },
    { alias: '@workspaces/be', head: COMMIT },
  ],
  requirements: { approval, flow, env, runId, resume: null, ...extra },
  inputs, resume: null,
});
const responseJson = ({ status = 'done', stop, next = status === 'done' ? ['git.publish'] : [], withOutputs = true } = {}) => ({
  schemaVersion: 9, operatorId: OPERATOR, step: 2, parallel: 1, status, ...(stop ? { stop } : {}),
  fallbacks: [], commits: [], next,
  fields: withOutputs ? {
    'api-verification': 'response/response.md',
    'api-cases': 'response/data/cases.json',
    'api-verdicts': 'response/data/verdicts.json',
    'api-output': OUTPUT_REF,
  } : {},
});

function writeBranch(files, { delta = { runtimeLadder: { servedHead: SERVED, contains: [COMMIT] } }, flowRoot = null } = {}) {
  const session = mkdtempSync(path.join(tmpdir(), 'api-session-'));
  const branch = path.join(session, 'step-2', 'parallel-1');
  const producer = path.join(session, 'step-1', 'parallel-1', 'response');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  mkdirSync(path.join(producer, 'data'), { recursive: true });
  writeFileSync(path.join(producer, 'response.md'), '# platform-operation-receipt — runtime demo-product/be\n');
  if (delta) writeFileSync(path.join(producer, 'data', 'delta.json'), JSON.stringify(delta, null, 2));
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'demo-product', startedAt: '2026-01-05T00:00:00Z', requestHashes: {}, chain: [['1/1'], ['2/1']], steps: { '1/1': 'runtime.serve', '2/1': OPERATOR }, current: '2/1', status: 'running' }));
  if (flowRoot) {
    const runs = path.join(flowRoot, 'api', 'runs', RUN);
    mkdirSync(runs, { recursive: true });
    writeFileSync(path.join(runs, 'result.json'), JSON.stringify({ runId: RUN, commit: COMMIT, lanes: verdictsJson().lanes }, null, 2));
    writeFileSync(path.join(flowRoot, 'api', 'latest.json'), JSON.stringify({ runId: RUN }));
    writeFileSync(path.join(flowRoot, 'api', 'history.md'), `# history\n\n- ${RUN} — three lanes pass\n`);
  }
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}
async function expectValid(files, label, options = onHost, dirs = {}) {
  const { branch, session } = writeBranch(files, dirs);
  const { errors } = await validateApiStep(branch, undefined, options);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label, options = onHost, dirs = {}) {
  const { branch, session } = writeBranch(files, dirs);
  const { errors } = await validateApiStep(branch, undefined, options);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

const walked = (over = {}) => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': receipt(),
  'response/data/cases.json': casesJson(),
  'response/data/verdicts.json': verdictsJson(),
  [OUTPUT_REF]: runnerOutput(),
  ...over,
});

// The lawful walk: the runner's cases, three lanes that pass, the record appended and the pointer moved.
const FLOW_ROOT = mkdtempSync(path.join(tmpdir(), 'api-flow-'));
await expectValid(walked({ 'response/data/verdicts.json': verdictsJson({ flowRoot: FLOW_ROOT }) }), 'a suite run as a client, three lanes passing, the record appended', onHost, { flowRoot: FLOW_ROOT });
await expectValid(walked(), 'a suite run as a client with three lanes passing');

// The lawful refusal: a case the runner reported failing blocks and still publishes its rows.
const failedCase = [{ ...CASES[0] }, { ...CASES[1], status: 'fail' }];
const blocked = (over = {}) => walked({
  'response/response.json': responseJson({ status: 'blocked', stop: 'API_CASE_FAILED', next: ['backend.generate'] }),
  'response/response.md': receipt({ cases: failedCase, exitCode: 1, lanes: [['contract', 'fail'], ['data', 'pass'], ['lifecycle', 'pass']] }),
  'response/data/cases.json': casesJson({ cases: failedCase, exitCode: 1 }),
  'response/data/verdicts.json': verdictsJson({ lanes: [{ lane: 'contract', verdict: 'fail', evidenceRefs: ['response/data/cases.json'], statement: 'a case the runner named did not hold' }, { lane: 'data', verdict: 'pass', evidenceRefs: ['response/data/verdicts.json'], statement: 'every record lies inside the run namespace' }, { lane: 'lifecycle', verdict: 'pass', evidenceRefs: ['response/data/verdicts.json'], statement: 'the namespace was read back and removed' }] }),
  [OUTPUT_REF]: runnerOutput(failedCase),
  ...over,
});
await expectValid(blocked(), 'a case the runner reported failing, blocked with its rows published');

// The request gate.
await expectError(walked({ 'request/request.json': requestJson({ approval: null }) }), 'required field approval has no value', 'a walk nobody authorised');
await expectError(walked({ 'request/request.json': requestJson({ flow: null }) }), 'required field flow has no value', 'a walk of no flow');
await expectError(walked({ 'request/request.json': requestJson({ env: 'no-such-stack' }) }), 'which this installation does not have', 'an env with no stack');
await expectError(walked({ 'request/request.json': requestJson({ approval: APPROVAL.replace(/[0-9a-f]{64}$/, '9'.repeat(64)) }) }), 'the declaration moved since it was read', 'a declaration reference whose hash no longer matches the file');
await expectError(walked({ 'request/request.json': requestJson({ inputs: {} }) }), 'required input platform-operation-receipt is absent', 'a walk against a runtime nobody attested');

// The served head is the platform receipt's.
const headless = () => { const c = casesJson(); delete c.servedHead; return c; };
await expectError(walked({ 'response/data/cases.json': headless() }), 'the record names no served head', 'a record that cannot say what answered it');
await expectError(walked(), 'is bound from no platform-operation-receipt', 'a served head no receipt attests', onHost, { delta: null });
await expectError(walked(), 'the platform receipt attests', 'a served head other than the attested one', onHost, { delta: { runtimeLadder: { servedHead: '3'.repeat(40), contains: [COMMIT] } } });
await expectError(walked(), 'the ancestry test is the receipt', 'an ancestry claim the receipt does not carry', onHost, { delta: { runtimeLadder: { servedHead: SERVED, contains: [] } } });

// The cases are the runner's.
await expectError(walked({ 'response/data/cases.json': casesJson({ cases: [...CASES, { caseId: 'enrolment refunds on cancellation', request: 'POST /graphql cancelEnrolment', status: 'pass', assertion: 'the refund is issued', durationMs: 90, evidenceRef: `${OUTPUT_REF}#L70` }] }) }), 'stands in no line of', 'a case the runner never printed');
await expectError(walked({ 'response/data/cases.json': casesJson({ cases: [{ ...CASES[0], evidenceRef: '' }, CASES[1]] }) }), 'carries no evidence reference', 'a case nobody can read back');
await expectError(walked({ 'response/data/cases.json': casesJson({ cases: [CASES[0], { ...CASES[1], status: 'skipped' }] }) }), 'did not hold, so this branch stops with API_CASE_FAILED', 'a case the runner named and never ran, published as a pass');
await expectError(walked({ 'response/data/cases.json': casesJson({ exitCode: 1 }) }), 'a non-zero exit is the suite saying it did not pass', 'a red suite reported as a done walk');
await expectError(walked({ 'response/data/cases.json': casesJson({ runId: '2026-01-05-1' }) }), 'is not <yyyymmdd-HHMMss>-<commit7>', 'a run nobody can place against its commit');

// The namespace owns everything this run wrote.
const leaked = [...RECORDS, { id: 'enrolment-77', store: 'enrolments', inNamespace: false, readBackRef: 'GET /graphql enrolment(id:)' }];
await expectError(walked({
  'response/data/verdicts.json': verdictsJson({ records: leaked }),
  'response/response.md': receipt({ records: leaked }),
}), 'API_NAMESPACE_LEAK', 'a record the suite wrote outside the run namespace');
await expectError(walked({ 'response/data/verdicts.json': verdictsJson({ records: [{ ...RECORDS[0], readBackRef: '' }] }) }), 'was not read back through the API', 'a record proved by something other than the API');
await expectError(walked({ 'response/data/verdicts.json': verdictsJson({ performed: false }) }), 'deletes its own namespace before it publishes', 'a walk that left its rows behind');

// The lanes.
await expectError(walked({
  'response/data/verdicts.json': verdictsJson({ lanes: [{ lane: 'contract', verdict: 'fail', evidenceRefs: ['response/data/cases.json'], statement: 'a case did not hold' }, { lane: 'data', verdict: 'pass', evidenceRefs: ['x'], statement: 'y' }, { lane: 'lifecycle', verdict: 'pass', evidenceRefs: ['x'], statement: 'y' }] }),
  'response/response.md': receipt({ lanes: [['contract', 'fail'], ['data', 'pass'], ['lifecycle', 'pass']] }),
}), 'lane did not pass, so this branch does not end done', 'a failing lane published as a done walk');
await expectError(walked({ 'response/response.json': responseJson({ next: [] }) }), 'all three lanes pass, so the run hands to git.publish', 'a passing walk that hands to nobody');

// The receipt binds the record.
await expectError(walked({ 'response/response.md': receipt({ servedHead: '3'.repeat(40) }) }), 'Binding names another served head', 'a receipt naming a head the record does not');
await expectError(walked({ 'response/response.md': receipt({ command: 'npx jest --runInBand' }) }), 'Binding names another command', 'a receipt naming a command that did not run');
await expectError(walked({ 'response/response.md': receipt({ namespace: 'uat-other-run' }) }), 'Binding names another namespace', 'a receipt naming another run namespace');
await expectError(walked({ 'response/response.md': receipt({ cases: [CASES[0]] }) }), 'the runner reported', 'a receipt that drops a case the runner reported');

// Custody.
await expectError(walked({ 'response/response.md': receipt({ findings: [['CREDENTIAL_VALUE_IN_OUTPUT', 'password: hunter2-hunter2 reached the log']] }) }), 'the shared UAT credential appears in a file this operator writes', 'a credential in the receipt');
await expectError(walked({ [OUTPUT_REF]: `${runnerOutput()}\nPGPASSWORD=hunter2-hunter2\n` }), 'the shared UAT credential appears in a file this operator writes', 'a credential in the runner output');

rmSync(FLOW_ROOT, { recursive: true, force: true });
rmSync(HOST, { recursive: true, force: true });
process.stdout.write('api.verify self-test: 3 valid branches, 25 rejected mutations\n');
