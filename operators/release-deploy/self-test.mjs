// Proves validate.mjs on a synthetic session branch: one steady deployment, one that took the
// recovery fallback, one that took both fallbacks and ended rolled back, one blocked on an unproven
// steady state, and one mutation per law, each of which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateReleaseStep } from './validate.mjs';

const RELEASE = 'release:2026.01.10-1';
const PREVIOUS = 'release:2026.01.03-2';
const DIGEST = `sha256:${'1'.repeat(64)}`;
const SAFE_DIGEST = `sha256:${'2'.repeat(64)}`;
const TARGET = 'production/api';
const APPROVAL = '@worktrees/businesses/features/release/model.json#deploy-grant';
const MANIFEST = '.stacks/production/api.manifest.json';
const ARTIFACT = '@remote/ghcr/starci/academy-api';
const DEADLINE = 600;
const PROBES = [
  { probeId: 'public-graphql-typename', kind: 'public', endpointRef: 'https://api.example/graphql', expectStatus: 200 },
];
const ROLLBACK = { releaseId: PREVIOUS, artifactRef: ARTIFACT, digest: SAFE_DIGEST, dataCompatible: true };

const observation = (at, condition, status = 'pass') => ({
  observedAt: at, condition, activeReleaseIds: [RELEASE], activeDigest: DIGEST, availableTargets: 1,
  probeResults: [{ probeId: 'public-graphql-typename', status, observedStatus: status === 'pass' ? 200 : 502, observedAt: at }],
});

const probesJson = ({ observations = [observation('2026-01-10T00:01:00.000Z', 'progressing'), observation('2026-01-10T00:07:00.000Z', 'steady')], finalCondition = 'steady', deadlineSeconds = DEADLINE, elapsedSeconds = 420, backoffSeconds = 30 } = {}) => ({
  deadlineSeconds, elapsedSeconds, backoffSeconds, observations, finalCondition,
});

const NL = String.fromCharCode(10);
const STEPS = [
  ['`authorize`', 'applied', '—', '—', 'the declared grant covers this project, environment and target'],
  ['`rollout`', 'applied', '4', '5', 'the target moved to the immutable digest'],
  ['`monitor`', 'applied', '—', '—', 'the window was observed to its end'],
];

function responseMd({
  release = RELEASE, digest = DIGEST, target = TARGET, approval = APPROVAL, deadline = DEADLINE,
  rollbackId = PREVIOUS, outcome = 'deployed', branch = 'none', steps = STEPS,
  monitoring = { Deadline: DEADLINE, Elapsed: 420, Backoff: 30, 'Final condition': 'steady' },
  steady = { 'Active digest': DIGEST, 'Available targets': '1 of 1', 'Superseded active': '0', 'Window elapsed': '300' },
  fallbacksTaken = [],
} = {}) {
  return `# release-deployment — ${release}

The immutable release reached its declared target under the declared grant, and the steady state
rests on the observed digest, the available targets and every declared probe across the window.

## Binding

| Field | Value |
| --- | --- |
| Operator | \`release.deploy\` |
| Step | \`step-1/parallel-1\` |
| Project | \`starci-academy\` |
| Release | ${release} |
| Artifact | \`${ARTIFACT}\` |
| Digest | \`${digest}\` |
| Target | ${target} |
| Environment | production |
| Replaced release | \`${PREVIOUS}\` |
| Approval | ${approval} |
| Manifest | \`${MANIFEST}\` |
| Steady deadline | ${deadline} |
| Rollback identity | ${rollbackId} |

## Outcome

| Field | Value |
| --- | --- |
| Outcome | ${outcome} |
| Branch | ${branch} |

## Steps

| Step | State | Revision before | Revision after | Statement |
| --- | --- | --- | --- | --- |
${steps.map((s) => `| ${s[0]} | ${s[1]} | ${s[2]} | ${s[3]} | ${s[4]} |`).join('\n')}

## Monitoring

| Field | Value |
| --- | --- |
| Deadline | ${monitoring.Deadline} |
| Elapsed | ${monitoring.Elapsed} |
| Backoff | ${monitoring.Backoff} |
| Final condition | ${monitoring['Final condition']} |

## Steady state

| Metric | Value |
| --- | --- |
${Object.entries(steady).map(([k, v]) => `| ${k} | ${/^sha256:/.test(String(v)) ? `\`${v}\`` : v} |`).join('\n')}

## Findings

| Code | Step | Statement |
| --- | --- | --- |
| \`IDEMPOTENT_NO_OP\` | \`host-prepare\` | the host already matched the declaration |

## Fallbacks taken

| Code | Action |
| --- | --- |
${fallbacksTaken.map((c) => `| \`${c}\` | the branch was taken and recorded |`).join(NL)}
`;
}

const requestJson = ({ release = RELEASE, target = TARGET, approval = APPROVAL, probes = PROBES, deadline = DEADLINE, rollbackIdentity = ROLLBACK, extra = {} } = {}) => ({
  schemaVersion: 9, operatorId: 'release.deploy', step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@remote/ghcr/starci/academy-api', head: null }],
  requirements: { release, target, approval, probes, steadyDeadline: deadline, rollbackIdentity, resume: null, ...extra },
  inputs: { 'quality-verification': 'step-1/parallel-1/response/quality.md' }, resume: null,
});

const responseJson = ({ status = 'done', stop, fallbacks = [], next = ['platform.operate'] } = {}) => ({
  schemaVersion: 9, operatorId: 'release.deploy', step: 1, parallel: 1, status, ...(stop ? { stop } : {}),
  fallbacks,
  fields: status === 'blocked' ? {} : { 'release-deployment': 'response/response.md', probes: 'response/data/probes.json' },
  commits: [], next,
});

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'release-session-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', chain: [['1/1']], steps: { '1/1': 'release.deploy' }, current: '1/1', status: 'running' }));
  writeFileSync(path.join(branch, 'response', 'quality.md'), '# quality\n');
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}

const baseline = (over = {}) => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': responseMd(),
  'response/data/probes.json': probesJson(),
  ...over,
});


// The recovery fallback: two failing observations, then steady again on the same release.
const recovered = () => baseline({
  'response/response.json': responseJson({ fallbacks: ['ROLLOUT_FAILED'] }),
  'response/data/probes.json': probesJson({
    observations: [observation('2026-01-10T00:01:00.000Z', 'failing', 'fail'), observation('2026-01-10T00:03:00.000Z', 'failing', 'fail'), observation('2026-01-10T00:07:00.000Z', 'steady')],
  }),
  'response/response.md': responseMd({
    branch: 'recover',
    steps: [...STEPS, ['`recover`', 'applied', '5', '6', 'the approved reversible action restored the target']],
    fallbacksTaken: ['ROLLOUT_FAILED'],
  }),
});

// Both fallbacks in order: the recovery ran out and the safe release was restored by digest.
const rolledBack = () => baseline({
  'response/response.json': responseJson({ fallbacks: ['ROLLOUT_FAILED', 'RECOVERY_EXHAUSTED'] }),
  'response/data/probes.json': probesJson({
    observations: [observation('2026-01-10T00:01:00.000Z', 'failing', 'fail'), observation('2026-01-10T00:03:00.000Z', 'failing', 'fail'), observation('2026-01-10T00:09:00.000Z', 'steady')],
  }),
  'response/response.md': responseMd({
    outcome: 'rolled-back', branch: 'rollback',
    steps: [...STEPS, ['`recover`', 'applied', '5', '6', 'the approved actions ran out'], ['`rollback`', 'applied', '6', '7', 'the safe release was restored by digest']],
    steady: { 'Active digest': SAFE_DIGEST, 'Available targets': '1 of 1', 'Superseded active': '0', 'Window elapsed': '300' },
    fallbacksTaken: ['ROLLOUT_FAILED', 'RECOVERY_EXHAUSTED'],
  }),
});

async function expectValid(files, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateReleaseStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateReleaseStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

await expectValid(baseline(), 'a steady deployment of the immutable release');
await expectValid(recovered(), 'the recovery fallback taken after a persistent failure');
await expectValid(rolledBack(), 'both fallbacks in order, ending in a restored release');
await expectValid({
  'request/request.json': requestJson(),
  'response/response.json': responseJson({ status: 'blocked', stop: 'STEADY_STATE_UNPROVEN', next: [] }),
  'response/response.md': null, 'response/data/probes.json': null,
}, 'blocked because the steady window never closed');

await expectError(baseline({ 'response/response.json': { ...responseJson(), stop: 'ROLLOUT_FAILED' } }), 'only a blocked response carries a stop', 'done with a stop');
await expectError(baseline({ 'response/response.json': responseJson({ status: 'blocked', stop: 'ROLLOUT_FAILED', next: [] }) }), 'has disposition fallback under these requirements', 'a fallback code used to block the branch');
await expectError(baseline({ 'response/response.json': responseJson({ fallbacks: ['STEADY_STATE_UNPROVEN'] }) }), 'cannot be taken as a fallback', 'a terminate code taken as a fallback');
await expectError(baseline({
  'response/response.json': responseJson({ fallbacks: ['RECOVERY_EXHAUSTED'] }),
  'response/response.md': responseMd({ outcome: 'rolled-back', branch: 'rollback', steps: [...STEPS, ['`rollback`', 'applied', '6', '7', 'restored']], steady: { 'Active digest': SAFE_DIGEST, 'Available targets': '1 of 1', 'Superseded active': '0', 'Window elapsed': '300' }, fallbacksTaken: ['RECOVERY_EXHAUSTED'] }),
}), 'reached only through an exhausted recovery', 'a rollback that skipped the recovery branch');
await expectError(baseline({ 'request/request.json': requestJson({ extra: { strategy: 'rolling' } }) }), 'requirements.strategy is not a field', 'a field the operator no longer declares');
await expectError(baseline({ 'request/request.json': requestJson({ approval: null }) }), 'required field approval has no value', 'a production deploy nobody approved');
await expectError(baseline({ 'request/request.json': requestJson({ probes: [{ probeId: 'container-health', kind: 'internal', endpointRef: 'unix:///health', expectStatus: 200 }] }), 'response/data/probes.json': probesJson({ observations: [{ ...observation('2026-01-10T00:01:00.000Z', 'progressing'), probeResults: [{ probeId: 'container-health', status: 'pass', observedStatus: 200, observedAt: '2026-01-10T00:01:00.000Z' }] }, { ...observation('2026-01-10T00:07:00.000Z', 'steady'), probeResults: [{ probeId: 'container-health', status: 'pass', observedStatus: 200, observedAt: '2026-01-10T00:07:00.000Z' }] }] }) }), 'at least one declared probe is public', 'a run proving only container health');
await expectError(baseline({ 'request/request.json': requestJson({ rollbackIdentity: { ...ROLLBACK, digest: 'v1.4.0' } }) }), 'a rollback by tag restores whatever the tag now points at', 'a rollback identity named by tag');
await expectError(baseline({ 'request/request.json': requestJson({ extra: { release: RELEASE }, target: TARGET, approval: 'ghp_abcdefghijklmnopqrstuvwxyz' }) }), 'looks like a resolved credential value', 'a token where a handle belongs');
await expectError(baseline({ 'request/request.json': requestJson({ deadline: 120 }) }), 'but the request pinned 120s', 'monitoring measured against another deadline');
await expectError(baseline({ 'response/data/probes.json': probesJson({ elapsedSeconds: 900 }) }), 'ran past its own bounded deadline', 'monitoring that outran its deadline');
await expectError(baseline({ 'response/data/probes.json': probesJson({ backoffSeconds: 900 }) }), 'backoff cannot exceed the deadline', 'a backoff wider than the window');
await expectError({
  ...recovered(),
  'response/data/probes.json': probesJson({ observations: [observation('2026-01-10T00:01:00.000Z', 'failing', 'fail'), observation('2026-01-10T00:07:00.000Z', 'steady')] }),
}, 'one transient probe is not a persistent failure', 'recovery entered on a single failing probe');
await expectError(baseline({ 'response/data/probes.json': probesJson({ finalCondition: 'deadline-exceeded' }) }), 'which is STEADY_STATE_UNPROVEN, not a deployment', 'a deployment over an exceeded deadline');
await expectError(baseline({ 'response/response.md': responseMd({ release: 'release:someone-elses' }) }), 'but the request bound', 'a receipt for another release');
await expectError(baseline({ 'response/response.md': responseMd({ digest: 'latest' }) }), 'identified by its digest, never by a tag', 'a release named by tag');
await expectError(baseline({ 'response/response.md': responseMd({ approval: '`someone-elses-grant`' }) }), 'names an approval the request did not bind', 'a grant borrowed from another deployment');
await expectError(baseline({ 'response/response.md': responseMd({ branch: 'recover' }) }), 'but the fallbacks taken say none', 'a branch the fallbacks never recorded');
await expectError({
  ...rolledBack(),
  'response/response.md': responseMd({ outcome: 'deployed', branch: 'rollback', steps: [...STEPS, ['`recover`', 'applied', '5', '6', 'x'], ['`rollback`', 'applied', '6', '7', 'y']], fallbacksTaken: ['ROLLOUT_FAILED', 'RECOVERY_EXHAUSTED'] }),
}, 'a restored release is its own terminal', 'a rollback reported as delivery');
await expectError(baseline({ 'response/response.md': responseMd({ steps: [['`authorize`', 'applied', '—', '—', 'x'], ['`rollout`', 'applied', '4', '4', 'y'], ['`monitor`', 'applied', '—', '—', 'z']] }) }), 'claims it applied without moving a revision', 'an application that moved nothing');
await expectError(baseline({ 'response/response.md': responseMd({ steps: [['`authorize`', 'applied', '2', '3', 'x'], ['`rollout`', 'applied', '4', '5', 'y'], ['`monitor`', 'applied', '—', '—', 'z']] }) }), 'reports a revision for a boundary it never touched', 'a reading step inventing a revision');
await expectError(baseline({ 'response/response.md': responseMd({ steady: { 'Active digest': SAFE_DIGEST, 'Available targets': '1 of 1', 'Superseded active': '0', 'Window elapsed': '300' } }) }), 'while another digest is active', 'a deployment over the old digest');
await expectError(baseline({ 'response/response.md': responseMd({ steady: { 'Active digest': DIGEST, 'Available targets': '1 of 2', 'Superseded active': '0', 'Window elapsed': '300' } }) }), 'a partly available target set is not steady state', 'one target absorbing the load for two');
await expectError(baseline({ 'response/response.md': responseMd({ steady: { 'Active digest': DIGEST, 'Available targets': '1 of 1', 'Superseded active': '1', 'Window elapsed': '300' } }) }), 'still serving traffic', 'a superseded target left active');
await expectError(baseline({ 'response/data/probes.json': probesJson({ observations: [observation('2026-01-10T00:07:00.000Z', 'steady')] }) }), 'claimed from a single observation', 'steady state read off one probe');
await expectError(baseline({ 'response/response.md': responseMd({ monitoring: { Deadline: DEADLINE, Elapsed: 420, Backoff: 30, 'Final condition': 'progressing' } }) }), 'but the series ended steady', 'a receipt disagreeing with its own series');
await expectError(baseline({ 'response/data/probes.json': { ...probesJson(), finalCondition: 'nope' } }), 'finalCondition', 'probes schema');
await expectError(baseline({ 'response/response.md': responseMd().replace('## Steady state', '## Stable state') }), 'missing section ^## Steady state$', 'receipt section renamed');

process.stdout.write('release.deploy self-test: 4 valid branches, 26 rejected mutations\n');
