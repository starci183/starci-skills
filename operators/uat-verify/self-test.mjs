// Proves validate.mjs on a synthetic session branch: a run a person asked for, admitted by both
// receipts at the pinned commit, with a capture and a screenshot per frozen case, three independent
// lanes, an appended run record and a moved latest pointer; a behaviour failure that routes to the
// backend; a UX failure that routes to a person; a run blocked before it published anything; and one
// mutation per law, each of which must fail with a line that names the defect. Two of the mutations
// are the custody proof: the placeholder for the shared UAT password may appear in no file this
// operator writes.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateUatStep } from './validate.mjs';

const FEATURE = 'enrollment';
const FLOW = 'paid-enrollment';
const RUN = 'run-2026-01-10-1';
const NS = `uat-${RUN}`;
const COMMIT = '1'.repeat(40);
const OTHER_COMMIT = '2'.repeat(40);
const FP = (c) => `sha256:${String(c).repeat(64)}`;
const DIR = `.worktrees/uat/${FEATURE}/${FLOW}`;
const SNAPSHOT_REF = `${DIR}/snapshot.json`;
const T = (m) => new Date(Date.UTC(2026, 0, 10, 0, m, 0)).toISOString();
const CASES = ['pay-and-enrol', 'abandon-checkout'];
const ASSERTIONS = { 'pay-and-enrol': ['entry', 'commitment', 'terminal'], 'abandon-checkout': ['entry', 'recovery'] };
const AUDIT_IN = 'step-1/parallel-1/response/response.md';
const QUALITY_IN = 'step-2/parallel-1/response/response.md';
const ROUTE_IN = 'step-1/parallel-2/response/data/route.json';
// The placeholder this operator's law forbids anywhere it writes.
const LEAK = 'UAT-SHARED-PASSWORD';

const frozenCase = (caseId, i, over = {}) => ({ caseId, order: i + 1, assertions: [...ASSERTIONS[caseId]], ...over });

function snapshot(over = {}) {
  return {
    runId: RUN, requestedBy: 'the product owner', feature: FEATURE, flow: FLOW, commit: COMMIT, frozenAt: T(10),
    flowRoot: 'PATCHED-BY-WRITE-BRANCH', snapshotRef: SNAPSHOT_REF, snapshotFingerprint: FP(3),
    lease: { leaseRef: `uat-lease://s-test/${FLOW}`, exclusive: true, expiresAt: T(180) },
    admission: [
      { kind: 'frontend-surface-audit', ref: AUDIT_IN, commit: COMMIT },
      { kind: 'quality-verification', ref: QUALITY_IN, commit: COMMIT },
    ],
    account: {
      username: `uat-${FLOW}`, role: 'learner', credentialName: 'uat-shared', credentialRef: '.stacks/local/secrets/uat.enc',
      custody: 'sealed-shared-master-identity', isUat: true, plaintextRecorded: false,
    },
    fixtureNamespace: NS,
    seed: { recordsRef: `${DIR}/seed/records.json`, expectedRef: `${DIR}/seed/expected.json`, fingerprint: FP(4), namespace: NS, isUat: true },
    cases: CASES.map((c, i) => frozenCase(c, i)),
    ...over,
  };
}

const capture = (caseId, over = {}) => ({
  caseId, runId: RUN, order: CASES.indexOf(caseId) + 1, executedAt: T(20 + CASES.indexOf(caseId)),
  screenshotRef: `response/artifacts/${caseId}.png`, loginFieldMasked: true, outcome: 'pass',
  assertions: ASSERTIONS[caseId].map((a) => ({ assertionId: a, lane: a === 'entry' ? 'ui' : 'behavior', observed: `the ${a} state was reached`, evidenceRef: `response/artifacts/${caseId}.png`, outcome: 'pass' })),
  ...over,
});

const lane = (name, verdict = 'pass') => ({ lane: name, verdict, evidenceRefs: [`response/data/captures/${CASES[0]}.json`], statement: `the ${name} lane was judged on its own evidence` });

// knowledge/ui/proof/ux.md: UX-1..UX-11 are the scored criteria and UX-12 is the arithmetic over
// them. `experience()` ships at a flat 4; `experienceFixFirst()` fails UX-3, one of the five gating
// criteria, and drops the mean below the bar.
const UX_MEASURED = {
  'UX-1': 'the run reached the terminal assertion and the store holds the record it names',
  'UX-2': 'four committed steps against a declared budget of five',
  'UX-3': 'the wrong value was corrected at its own field and the flow finished two steps later',
  'UX-4': 'the pressed treatment rendered in 60ms and the pending indicator held the initiator',
  'UX-5': 'the destination sat one navigation level from entry and the three place signals agreed',
  'UX-6': 'every state the run reached offered a next action or a way back',
  'UX-7': 'back, reload and a fresh session each returned the same step with its values',
  'UX-8': 'every field kept a visible label and tab order equalled reading order',
  'UX-9': 'the primary action sat in the lower half at the narrowest declared viewport',
  'UX-10': 'one verb per action across both surfaces of the run',
  'UX-11': 'labels named the things, controls named the effects, no stub copy survived',
};
const UX_RULES = Object.keys(UX_MEASURED);
const experience = () => ({
  entries: UX_RULES.map((rule) => ({ rule, measured: UX_MEASURED[rule], score: 4, verdict: 'pass', routeTo: 'none' })),
  mean: 4,
  verdict: 'ship',
  routeTo: 'none',
});
const experienceFixFirst = () => {
  const lens = experience();
  lens.entries[2] = { rule: 'UX-3', measured: 'the flow restarted to correct one field', score: 2, verdict: 'fail', routeTo: 'direction' };
  lens.mean = 3.82;
  lens.verdict = 'fix-first';
  lens.routeTo = 'direction';
  return lens;
};
const lanes = (over = {}) => ['behavior', 'ux', 'ui'].map((l) => lane(l, over[l] ?? 'pass'));

function verdicts(over = {}) {
  return {
    runId: RUN, commit: COMMIT, resultRef: `${DIR}/runs/${RUN}/result.json`, latestRef: `${DIR}/latest`,
    lanes: lanes(), experience: experience(), cleanup: { performed: true, isUat: true, namespace: NS, runRecordsDeleted: false },
    ...over,
  };
}

function responseMd({ snap = snapshot(), verd = verdicts(), outcomes = { 'pay-and-enrol': 'pass', 'abandon-checkout': 'pass' }, note = 'The shared credential is named, never printed, and every login field is masked.' } = {}) {
  return `# uat-flow-verification — ${snap.feature}/${snap.flow}

The product owner asked for this run; it was admitted at one commit, executed case by case in the
frozen order, and judged on three independent lanes. ${note}

## Admission

| Kind | Ref | Commit |
| --- | --- | --- |
${snap.admission.map((a) => `| \`${a.kind}\` | \`${a.ref}\` | \`${a.commit}\` |`).join('\n')}

## Snapshot

| Field | Value |
| --- | --- |
| Run | \`${snap.runId}\` |
| Requested by | ${snap.requestedBy} |
| Feature | \`${snap.feature}\` |
| Flow | \`${snap.flow}\` |
| Commit | \`${snap.commit}\` |
| Snapshot | \`${snap.snapshotRef}\` |
| Namespace | \`${snap.fixtureNamespace}\` |
| Credential | \`${snap.account.credentialRef}\`, resolved by name at login only |
| Run record | \`${verd.resultRef}\` |
| Latest | \`${snap.runId}\` |

## Cases

| Case | Order | Assertions | Capture | Screenshot | Outcome |
| --- | --- | --- | --- | --- | --- |
${snap.cases.map((c) => `| \`${c.caseId}\` | ${c.order} | ${c.assertions.join(', ')} | \`response/data/captures/${c.caseId}.json\` | \`response/artifacts/${c.caseId}.png\` | ${outcomes[c.caseId] ?? 'pass'} |`).join('\n')}

## Lanes

| Lane | Verdict | Evidence |
| --- | --- | --- |
${verd.lanes.map((l) => `| \`${l.lane}\` | ${l.verdict} | \`${l.evidenceRefs[0]}\` |`).join('\n')}

## Experience

| Rule | Measured | Score | Verdict |
| --- | --- | --- | --- |
${verd.experience.entries.map((r) => `| \`${r.rule}\` | ${r.measured} | ${r.score} | ${r.verdict} |`).join('\n')}

- Mean: ${verd.experience.mean.toFixed(2)}
- Verdict: ${verd.experience.verdict}

## Verdict

| Topic | Verdict | Route |
| --- | --- | --- |
| \`experience\` | ${verd.experience.verdict} | ${verd.experience.routeTo} |

## Fallbacks taken

| Code | Action |
| --- | --- |
`;
}

const requestJson = ({ extra = {}, inputs, cases = [...CASES] } = {}) => ({
  schemaVersion: 9, operatorId: 'uat.verify', step: 3, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@workspaces/be', head: COMMIT }, { alias: '@worktrees/uat/enrollment/paid-enrollment', head: null }],
  requirements: { requestedBy: 'the product owner', feature: FEATURE, flow: FLOW, cases, runId: RUN, lease: `uat-lease://s-test/${FLOW}`, resume: null, ...extra },
  inputs: inputs ?? { 'frontend-surface-audit': AUDIT_IN, 'quality-verification': QUALITY_IN, route: ROUTE_IN },
  resume: null,
});

function responseJson({ status = 'done', stop, next = ['git.publish'], captures = CASES.map((c) => `response/data/captures/${c}.json`), shots = CASES.map((c) => `response/artifacts/${c}.png`), drop } = {}) {
  const fields = {
    'uat-flow-verification': 'response/response.md',
    'uat-snapshot': 'response/data/snapshot.json',
    'uat-capture': captures,
    'uat-verdicts': 'response/data/verdicts.json',
    screenshot: shots,
    sheet: 'response/artifacts/sheet.png',
  };
  if (drop) delete fields[drop];
  return { schemaVersion: 9, operatorId: 'uat.verify', step: 3, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks: [], fields, commits: [], next };
}

// history: 'match' appends the record this run publishes; 'none' leaves no flow directory on disk;
// 'missing-run' leaves the directory without the record; 'rewritten' leaves another result under the
// same runId; 'stale-latest' points latest at another run.
function writeBranch(files, history = 'match') {
  const session = mkdtempSync(path.join(tmpdir(), 'uat-session-'));
  const branch = path.join(session, 'step-3', 'parallel-1');
  for (const d of ['request', 'response/data/captures', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  for (const input of [AUDIT_IN, QUALITY_IN, ROUTE_IN]) {
    mkdirSync(path.dirname(path.join(session, input)), { recursive: true });
    writeFileSync(path.join(session, input), input.endsWith('.json') ? '{}\n' : '# admitting receipt\n');
  }
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'starci-academy', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['3/1']], steps: { '3/1': 'uat.verify' }, current: '3/1', status: 'running' }));
  for (const c of CASES) writeFileSync(path.join(branch, 'response', 'artifacts', `${c}.png`), 'png');
  writeFileSync(path.join(branch, 'response', 'artifacts', 'sheet.png'), 'png');

  const flowRoot = path.join(session, 'flow-root');
  const prepared = { ...files };
  const snap = prepared['response/data/snapshot.json'];
  if (snap && typeof snap === 'object') prepared['response/data/snapshot.json'] = { ...snap, flowRoot };
  for (const [name, content] of Object.entries(prepared)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }

  if (history !== 'none') {
    mkdirSync(flowRoot, { recursive: true });
    const verd = prepared['response/data/verdicts.json'];
    if (history !== 'missing-run' && verd && typeof verd === 'object') {
      const runDir = path.join(flowRoot, 'runs', verd.runId);
      mkdirSync(runDir, { recursive: true });
      const recorded = history === 'rewritten'
        ? { runId: verd.runId, commit: OTHER_COMMIT, lanes: verd.lanes }
        : { runId: verd.runId, commit: verd.commit, lanes: verd.lanes };
      writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(recorded, null, 2));
    }
    writeFileSync(path.join(flowRoot, 'latest'), history === 'stale-latest' ? 'run-2026-01-09-1' : RUN);
  }
  return { branch, session };
}

const baseline = () => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': responseMd(),
  'response/data/snapshot.json': snapshot(),
  'response/data/verdicts.json': verdicts(),
  ...Object.fromEntries(CASES.map((c) => [`response/data/captures/${c}.json`, capture(c)])),
});

function withVerdicts(over, { next, outcomes } = {}) {
  // The ux lane is the experience lens’ own verdict, so a failing lane carries a failing lens.
  const verd = verdicts({ lanes: lanes(over), experience: over.ux === 'fail' ? experienceFixFirst() : experience() });
  return {
    ...baseline(),
    'response/data/verdicts.json': verd,
    'response/response.md': responseMd({ verd, outcomes }),
    'response/response.json': responseJson({ next }),
  };
}

const blocked = () => ({
  'request/request.json': requestJson(),
  'response/response.json': { schemaVersion: 9, operatorId: 'uat.verify', step: 3, parallel: 1, status: 'blocked', stop: 'ADMISSION_MISSING', fallbacks: [], fields: {}, commits: [], next: [] },
});

async function expectValid(files, label, history) {
  const { branch, session } = writeBranch(files, history);
  const { errors } = await validateUatStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label, history) {
  const { branch, session } = writeBranch(files, history);
  const { errors } = await validateUatStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

await expectValid(baseline(), 'a run a person asked for, admitted at the pinned commit, three lanes passing');
await expectValid(withVerdicts({ behavior: 'fail' }, { next: ['backend.source.apply'], outcomes: { 'pay-and-enrol': 'fail', 'abandon-checkout': 'pass' } }), 'a behaviour failure routed to the backend');
await expectValid(withVerdicts({ ux: 'fail' }, { next: ['user'], outcomes: { 'pay-and-enrol': 'fail', 'abandon-checkout': 'pass' } }), 'a UX failure routed to a person');
await expectValid(blocked(), 'blocked on a missing admission, publishing nothing', 'none');

// The gate and the person behind the run.
await expectError({ ...baseline(), 'response/response.json': { ...responseJson(), stop: 'LEASE_INVALID' } }, 'only a blocked response carries a stop', 'a done branch carrying a stop');
await expectValid({ ...blocked(), 'response/response.json': { schemaVersion: 9, operatorId: 'uat.verify', step: 3, parallel: 1, status: 'blocked', stop: 'RUNTIME_UNAVAILABLE', fallbacks: [], fields: {}, commits: [], next: [] } }, 'blocked on the shared RUNTIME_UNAVAILABLE code');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { password: 'x' } }) }, 'requirements.password is not a field', 'a credential has nowhere to go in a request');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { requestedBy: '' } }) }, 'required field requestedBy has no value', 'a run nobody asked for');
await expectError({ ...baseline(), 'request/request.json': requestJson({ inputs: { 'frontend-surface-audit': AUDIT_IN, route: ROUTE_IN } }) }, 'required input quality-verification is absent', 'a run admitted by one receipt only');

// Admission at the pinned commit.
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ admission: [{ kind: 'frontend-surface-audit', ref: AUDIT_IN, commit: COMMIT }, { kind: 'quality-verification', ref: QUALITY_IN, commit: OTHER_COMMIT }] }) }, 'ADMISSION_MISSING — quality-verification was taken at', 'an admission from another commit');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ admission: [{ kind: 'frontend-surface-audit', ref: AUDIT_IN, commit: COMMIT }, { kind: 'frontend-surface-audit', ref: AUDIT_IN, commit: COMMIT }] }) }, 'ADMISSION_MISSING — quality-verification is absent', 'a missing admission');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ admission: [{ kind: 'frontend-surface-audit', ref: 'step-9/parallel-1/response/response.md', commit: COMMIT }, { kind: 'quality-verification', ref: QUALITY_IN, commit: COMMIT }] }) }, 'but the request handed in', 'an admission the request never handed in');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ commit: OTHER_COMMIT }) }, 'but the request pinned @workspaces/be at', 'a snapshot frozen at another commit');
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ commit: OTHER_COMMIT }) }, 'is not the pinned head', 'a result carrying another commit');

// Three lanes, judged apart.
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ lanes: [lane('behavior'), lane('ux')] }) }, 'the ui lane is missing', 'two lanes instead of three');
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ lanes: [lane('behavior'), lane('behavior'), lane('ui')] }) }, 'a lane may report at most one verdict', 'one lane judged twice');
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ lanes: [lane('behavior'), { ...lane('ux'), verdict: 'unavailable' }, lane('ui')] }) }, 'outside the allowed enum', 'a lane that is neither pass nor fail');
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ lanes: [lane('behavior'), { ...lane('ux'), evidenceRefs: [] }, lane('ui')] }) }, 'array is too short', 'a lane with no evidence');
await expectError({ ...withVerdicts({ behavior: 'fail' }, { next: ['git.publish'] }) }, 'a failing lane cannot hand to git.publish', 'a failing run handed to publication');
await expectError({ ...baseline(), 'response/response.json': responseJson({ next: [] }) }, 'hands to git.publish', 'a passing run that routes nowhere');
await expectError({ ...withVerdicts({ ux: 'fail' }, { next: ['backend.source.apply'] }) }, 'it hands to a person', 'a UX failure routed away from the person');

// Evidence per case.
await expectError({ ...baseline(), 'response/response.json': responseJson({ captures: [`response/data/captures/${CASES[0]}.json`] }), [`response/data/captures/${CASES[1]}.json`]: null }, `case ${CASES[1]} has no capture registered`, 'a frozen case with no capture');
await expectError({ ...baseline(), 'response/response.json': responseJson({ shots: [`response/artifacts/${CASES[0]}.png`] }) }, `case ${CASES[1]} has no screenshot registered`, 'a frozen case with no screenshot');
await expectError({ ...baseline(), [`response/data/captures/${CASES[0]}.json`]: capture(CASES[0], { loginFieldMasked: false }) }, 'expected true', 'a capture that cannot say the login field was masked');
await expectError({ ...baseline(), [`response/data/captures/${CASES[0]}.json`]: capture(CASES[0], { executedAt: T(5) }) }, 'executed at or before the snapshot freeze', 'a case executed before the freeze');
await expectError({ ...baseline(), [`response/data/captures/${CASES[0]}.json`]: capture(CASES[0], { assertions: capture(CASES[0]).assertions.slice(0, 2) }) }, 'was never observed', 'a frozen assertion nobody observed');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ cases: [frozenCase(CASES[0], 1), frozenCase(CASES[1], 2)] }) }, 'contiguous order starting at 1', 'a frozen order that starts at two');
await expectError({ ...baseline(), 'request/request.json': requestJson({ cases: [CASES[0], 'ghost-case'] }) }, 'requested case ghost-case was never frozen', 'a case the snapshot never froze');

// Custody: the password may appear in nothing this operator writes.
await expectError({ ...baseline(), 'response/response.md': responseMd({ note: `The tester signed in with ${LEAK} and continued.` }) }, 'the shared UAT password appears in a file this operator writes', 'the password published in the receipt');
await expectError({ ...baseline(), [`response/data/captures/${CASES[0]}.json`]: capture(CASES[0], { assertions: [{ assertionId: 'entry', lane: 'ui', observed: `the login form held ${LEAK}`, evidenceRef: 'x', outcome: 'pass' }, { assertionId: 'commitment', lane: 'behavior', observed: 'ok', evidenceRef: 'x', outcome: 'pass' }, { assertionId: 'terminal', lane: 'behavior', observed: 'ok', evidenceRef: 'x', outcome: 'pass' }] }) }, 'the shared UAT password appears in a file this operator writes', 'the password recorded in a capture');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ account: { ...snapshot().account, password: 'x' } }) }, 'unexpected property', 'an account record with a place to hold a secret');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ account: { ...snapshot().account, credentialRef: '.stacks/local/secrets/uat.txt' } }) }, 'string does not match', 'a credential outside the sealed file');

// Namespace and append-only history.
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ cleanup: { performed: true, isUat: true, namespace: 'uat-anything', runRecordsDeleted: false } }) }, 'cleanup must name the exact run fixture namespace', 'a cleanup wider than the run');
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ cleanup: { performed: true, isUat: true, namespace: NS, runRecordsDeleted: true } }) }, 'expected false', 'a cleanup that deleted a run record');
await expectError(baseline(), 'runs are append-only', 'a run record rewritten with another result', 'rewritten');
await expectError(baseline(), 'appends its record under runs/', 'a decided run that appended nothing', 'missing-run');
await expectError(baseline(), 'but this run published', 'a latest pointer left on another run', 'stale-latest');

// The receipt agrees with the machine record.
await expectError({ ...baseline(), 'response/response.md': responseMd().replace(`| Commit | \`${COMMIT}\` |`, `| Commit | \`${OTHER_COMMIT}\` |`) }, 'Snapshot names another commit', 'a receipt naming another commit');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('## Cases', '## Case list') }, 'missing section ^## Cases$', 'a receipt section renamed');
await expectError({ ...baseline(), 'response/response.json': responseJson({ drop: 'uat-verdicts' }) }, 'required output uat-verdicts is not in fields', 'a decided run that published no verdicts');

// The experience lane is scored, not asserted: UX-12 computes it, and the receipt copies it.
await expectValid(withVerdicts({ ux: 'fail' }, { next: ['user'], outcomes: { 'pay-and-enrol': 'fail', 'abandon-checkout': 'pass' } }), 'a run whose experience lane is fix-first on a gating criterion');
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ experience: { ...experience(), mean: 5 } }) }, 'the eleven scores average 4.00', 'an experience mean nobody computed');
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ experience: { ...experience(), verdict: 'fix-first' } }) }, 'UX-12 makes it ship', 'an experience verdict UX-12 does not produce');
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ experience: { ...experience(), entries: experience().entries.slice(0, 10) } }) }, 'array is too short', 'a criterion left out of the experience lane');
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ experience: (() => { const l = experience(); l.entries[0] = { ...l.entries[0], verdict: 'fail', routeTo: 'none' }; l.mean = 4; l.verdict = 'fix-first'; l.routeTo = 'direction'; return l; })() }) }, 'fails UX-1 and routes nowhere', 'an experience failure that routes nowhere');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('| `experience` | ship | none |', '| `experience` | fix-first | direction |') }, 'Verdict records fix-first', 'a receipt whose experience row differs from the lane');

process.stdout.write('uat.verify self-test: 6 valid branches, 40 rejected mutations\n');
