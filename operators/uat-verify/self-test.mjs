// Proves validate.mjs on a synthetic session branch: a run triggered by a chain, admitted by both
// receipts at the pinned commit, with a capture and a screenshot per frozen case, three independent
// lanes, an appended run record and a moved latest pointer; a behaviour failure that routes to the
// backend; a UX failure that routes to a person; a run blocked before it published anything; a run
// authorised by the environment's own declaration and one authorised only by a person's approval id;
// and one mutation per law, each of which must fail with a line that names the defect. Two of the
// mutations are the custody proof: the placeholder for the shared UAT password may appear in no file
// this operator writes. Two more prove a walk is evidence only for what it pressed: a step with no
// recorded control and a criterion scored from one both fail on the assertion's own required field.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateUatStep, UAT_CLASSES } from './validate.mjs';
import { walkFingerprint, stepControl } from '../../scripts/validate-walk.mjs';

const FEATURE = 'enrollment';
const FLOW = 'paid-enrollment';
const RUN = '20260110-000000-1111111';
const NS = `uat-${RUN}`;
const ENV = 'dev';
const BT = String.fromCharCode(96);
const ENTRY = 'demo-product/fe';
const COMMIT = '1'.repeat(40);
const OTHER_COMMIT = '2'.repeat(40);
// A plain approval id, exactly as a person-marked environment requires; most branches below need
// nothing more specific than that this run's writes were authorised by something.
const APPROVAL = 'approval-uat-owner-1';
const FP = (c) => `sha256:${String(c).repeat(64)}`;
const DIR = `.worktrees/uat/${FEATURE}/${FLOW}`;
const SNAPSHOT_REF = `${DIR}/snapshot.json`;
const T = (m) => new Date(Date.UTC(2026, 0, 10, 0, m, 0)).toISOString();
const CASES = ['pay-and-enrol', 'abandon-checkout'];
const ASSERTIONS = { 'pay-and-enrol': ['entry', 'commitment', 'terminal'], 'abandon-checkout': ['entry', 'recovery'] };
const AUDIT_IN = 'step-1/parallel-1/response/response.md';
const QUALITY_IN = 'step-2/parallel-1/response/response.md';
const ROUTE_IN = 'step-1/parallel-2/response/data/route.json';
const ACCOUNT_IN = 'step-2/parallel-2/response/data/account.json';
const UAT_PLAN_IN = 'step-1/parallel-3/response/response.md';
const CASE_SHEET_IN = 'step-1/parallel-3/response/data/cases.json';
const SEED_IN = 'step-2/parallel-3/response/response.md';
// The placeholder this operator's law forbids anywhere it writes.
const LEAK = 'UAT-SHARED-PASSWORD';

const frozenCase = (caseId, i, over = {}) => ({ caseId, order: i + 1, as: 'learner', assertions: [...ASSERTIONS[caseId]], ...over });
const account = (alias = 'learner', over = {}) => ({
  alias, username: `uat-${FLOW}-${alias}`, role: alias,
  memberships: [`${alias}s`], providerAccountRef: `provider://accounts/${alias}`, accountAction: 'create',
  loginProof: { method: 'browser', endpoint: 'http://localhost:3000/login', outcome: 'passed', evidenceRef: 'response/data/captures/login.json', verifiedAt: T(9) },
  credentialName: 'uat-shared', credentialRef: `.stacks/${ENV}/secrets/uat.enc`,
  custody: 'sealed-shared-master-identity', isUat: true, plaintextRecorded: false, identity: ENTRY, provisionedBy: RUN, ...over,
});
const accountInput = (env = ENV) => ({
  env, flow: FLOW, identity: ENTRY,
  accounts: Object.fromEntries(snapshot({ env, accounts: [account('learner', { credentialRef: `.stacks/${env}/secrets/uat.enc` })] }).accounts.map((a) => [a.alias, {
    username: a.username, role: a.role, memberships: a.memberships, providerAccountRef: a.providerAccountRef,
    action: a.accountAction, observedAt: T(9), loginProof: a.loginProof,
    credentialName: a.credentialName, sealed: a.credentialRef, provisionedBy: a.provisionedBy, createdAt: T(8),
  }])),
  plaintextRecorded: false,
});
const caseSheetInput = (env = ENV) => ({
  contractVersion: 'starci/v2.2', feature: FEATURE, env, planVersion: 'uat-plan/1',
  flows: [{ flowId: FLOW, state: 'valid', action: 'reuse', entry: '/enroll', actorAliases: ['learner'], namespace: NS }],
  cases: CASES.map((caseId, i) => ({
    caseId, flowId: FLOW, order: i + 1, actor: 'learner',
    preconditions: ['the account and namespaced seed are ready'], inputs: ['representative enrollment'],
    actions: ['enter the flow', 'complete the case'], assertions: [...ASSERTIONS[caseId]],
    expected: ASSERTIONS[caseId].map((id) => `${id} holds`), verification: ['observe each assertion through the UI'],
    fixture: { jsonRef: `.worktrees/uat/${FEATURE}/${FLOW}/seed/records.json`, sqlRef: null, createsAssertedOutcome: false },
    cleanup: 'data.seed rolls back the receipt-owned namespace',
  })),
});

// One product serves one integration branch on one port, so what keeps two concurrent runs apart is
// this: each drives its own browser profile, seeds only rows under its own namespace, and rolls back
// only what it seeded.
const SERVED_HEAD = '7'.repeat(40);
const isolation = (over = {}) => ({
  sessionId: 's-test',
  browserProfileRef: '.worktrees/sessions/s-test/browser',
  servedHead: SERVED_HEAD,
  servedContainsCommit: true,
  ancestryEvidenceRef: 'response/data/ancestry.json',
  seededIds: [`${NS}-learner`, `${NS}-enrollment`],
  rollbackIds: [`${NS}-enrollment`],
  ...over,
});

function snapshot(over = {}) {
  return {
    runId: RUN, approval: APPROVAL, feature: FEATURE, flow: FLOW, env: ENV, commit: COMMIT, frozenAt: T(10),
    flowRoot: 'PATCHED-BY-WRITE-BRANCH', snapshotRef: SNAPSHOT_REF, snapshotFingerprint: FP(3),
    lease: { leaseRef: `uat-lease://s-test/${FLOW}`, exclusive: true, expiresAt: T(180) },
    admission: [
      { kind: 'frontend-surface-audit', ref: AUDIT_IN, commit: COMMIT },
      { kind: 'quality-verification', ref: QUALITY_IN, commit: COMMIT },
    ],
    accounts: [account()],
    flowSource: 'planned',
    golden: { state: 'candidate', ref: `${DIR}/snapshots/snapshot.json`, approvedBy: null, env: ENV },
    fixtureNamespace: NS,
    seed: { recordsRef: `${DIR}/seed/records.json`, expectedRef: `${DIR}/seed/expected.json`, fingerprint: FP(4), namespace: NS, isUat: true },
    isolation: isolation(),
    cases: CASES.map((c, i) => frozenCase(c, i)),
    ...over,
  };
}

const capture = (caseId, over = {}) => ({
  caseId, runId: RUN, order: CASES.indexOf(caseId) + 1, executedAt: T(20 + CASES.indexOf(caseId)),
  screenshotRef: `response/artifacts/${caseId}.png`, loginFieldMasked: true, captureStartedAfterRedirect: true, outcome: 'pass',
  assertions: ASSERTIONS[caseId].map((a) => ({ assertionId: a, lane: a === 'entry' ? 'ui' : 'behavior', observed: `the ${a} state was reached`, control: `${caseId}/${a}-control`, evidenceRef: `response/artifacts/${caseId}.png`, outcome: 'pass' })),
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
    runId: RUN, commit: COMMIT, resultRef: `${DIR}/runs/${RUN}/result.json`, latestRef: `${DIR}/latest.json`, historyRef: `${DIR}/history.md`,
    lanes: lanes(), experience: experience(), cleanup: { performed: false, owner: 'data.seed', seedReceiptRef: SEED_IN, isUat: true, namespace: NS, runRecordsDeleted: false },
    ...over,
  };
}

const PRINTED = [`| ${BT}response/artifacts/sheet.png${BT} | the run's step captures, printed before the verdict was published |`];

function responseMd({ snap = snapshot(), verd = verdicts(), outcomes = { 'pay-and-enrol': 'pass', 'abandon-checkout': 'pass' }, printed = PRINTED, note = 'The shared credential is named, never printed, and every login field is masked.' } = {}) {
  return `# uat-flow-verification — ${snap.feature}/${snap.flow}

The chain that built and proved this surface reached this run next; it was admitted at one commit,
executed case by case in the frozen order, and judged on three independent lanes. ${note}

## Admission

| Kind | Ref | Commit |
| --- | --- | --- |
${snap.admission.map((a) => `| \`${a.kind}\` | \`${a.ref}\` | \`${a.commit}\` |`).join('\n')}

## Snapshot

| Field | Value |
| --- | --- |
| Run | \`${snap.runId}\` |
| Approval | ${snap.approval} |
| Feature | \`${snap.feature}\` |
| Flow | \`${snap.flow}\` |
| Commit | \`${snap.commit}\` |
${snap.provenance ? `| Frontend commit | ${snap.provenance.fe} |\n| Backend commit | ${snap.provenance.be} |\n` : ''}\
| Snapshot | \`${snap.snapshotRef}\` |
| Namespace | \`${snap.fixtureNamespace}\` |
| Accounts | ${snap.accounts.map((a) => BT + a.alias + BT).join(', ')} |
| Environment | ${snap.env} |
| Credential | \`${snap.accounts[0].credentialRef}\`, resolved by name at login only |
| Flow source | ${snap.flowSource} |
| Golden | ${snap.golden.state}, awaiting a person's approval |
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

## Printed

| Artifact | Why |
| --- | --- |
${printed.join('\n')}

## Findings

| Code | Statement |
| --- | --- |

## Fallbacks taken

| Code | Action |
| --- | --- |
`;
}

const requestJson = ({ extra = {}, inputs, cases = [...CASES] } = {}) => ({
  schemaVersion: 9, operatorId: 'uat.verify', step: 3, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@workspaces/be', head: COMMIT }, { alias: '@worktrees/uat/enrollment/paid-enrollment', head: null }],
  requirements: { approval: APPROVAL, feature: FEATURE, flow: FLOW, env: ENV, cases, runId: RUN, lease: `uat-lease://s-test/${FLOW}`, resume: null, ...extra },
  inputs: inputs ?? { 'frontend-surface-audit': AUDIT_IN, 'quality-verification': QUALITY_IN, route: ROUTE_IN, 'uat-account': ACCOUNT_IN, 'uat-plan': UAT_PLAN_IN, 'uat-case-sheet': CASE_SHEET_IN, 'seed-receipt': SEED_IN },
  resume: null,
});

function responseJson({ status = 'done', stop, next = ['data.seed', 'git.publish', 'user'], captures = CASES.map((c) => `response/data/captures/${c}.json`), shots = CASES.map((c) => `response/artifacts/${c}.png`), drop } = {}) {
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
  files = structuredClone(files);
  const requestEnv = files['request/request.json']?.requirements?.env ?? ENV;
  if (files['response/response.md'] && !files['response/response.md'].includes('## Audit scope')) files['response/response.md'] += "\n## Audit scope\n\n| Field | Value |\n| --- | --- |\n| Mode | not-recorded |\n| Coverage claim | not-recorded |\n| Deferred states | — |\n";

  const session = mkdtempSync(path.join(tmpdir(), 'uat-session-'));
  const branch = path.join(session, 'step-3', 'parallel-1');
  for (const d of ['request', 'response/data/captures', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  for (const input of [AUDIT_IN, QUALITY_IN, ROUTE_IN, ACCOUNT_IN, UAT_PLAN_IN, CASE_SHEET_IN, SEED_IN]) {
    mkdirSync(path.dirname(path.join(session, input)), { recursive: true });
    const content = input === ACCOUNT_IN ? accountInput(requestEnv)
      : input === CASE_SHEET_IN ? caseSheetInput(requestEnv)
      : input === SEED_IN ? `# seed-receipt — ${FLOW}\n\n## Binding\n\n| Field | Value |\n| --- | --- |\n| Flow | ${FLOW} |\n| Environment | ${requestEnv} |\n| Namespace | ${NS} |\n| Seed fingerprint | ${FP(4)} |\n`
      : input === UAT_PLAN_IN ? `# uat-plan — ${FEATURE}\n\n## Flows\n\n| Flow | Entry | Steps | Account | Seed namespace | Tier |\n| --- | --- | --- | --- | --- | --- |\n| ${FLOW} | /enroll | 4 | learner | ${NS} | journey |\n`
      : input.endsWith('.json') ? {} : '# admitting receipt\n';
    writeFileSync(path.join(session, input), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  if(files['request/request.json']?.contexts?.some(c=>c.alias==='@workspaces/fe')) {
    for(const [kind,ref,operator]of [['frontend-surface-audit',AUDIT_IN,'interface.audit'],['quality-verification',QUALITY_IN,'quality.verify']]){
      const responseDir=path.dirname(path.join(session,ref)),owner=path.dirname(responseDir);mkdirSync(path.join(owner,'request'),{recursive:true});
      writeFileSync(path.join(owner,'request/request.json'),JSON.stringify({operatorId:operator,contexts:[{alias:'@workspaces/fe',head:COMMIT},{alias:'@workspaces/be',head:OTHER_COMMIT}]}));
      writeFileSync(path.join(responseDir,'response.json'),JSON.stringify({operatorId:operator,status:'done',fields:{[kind]:'response/response.md'}}));
      writeFileSync(path.join(session,ref),kind==='frontend-surface-audit'?`# audit\n\n## Served surface\n\n| Field | Value |\n| --- | --- |\n| Applied commit | ${COMMIT} |\n`:`# quality\n\n## Binding\n\n| Field | Value |\n| --- | --- |\n| Head | ${COMMIT} |\n| Checkout | @workspaces/fe |\n`);
    }
    writeFileSync(path.join(session,ROUTE_IN),JSON.stringify({role:'fe'}));
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
    mkdirSync(path.dirname(path.join(branch,name)),{recursive:true});
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
        : { runId: verd.runId, commit: verd.commit, lanes: verd.lanes, ...(verd.provenance?{provenance:verd.provenance}:{}) };
      writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(recorded, null, 2));
    }
    writeFileSync(path.join(flowRoot, 'latest.json'), JSON.stringify({ runId: history === 'stale-latest' ? '20260109-000000-1111111' : RUN }, null, 2));
    if (history === 'ignored') writeFileSync(path.join(flowRoot, '.gitignore'), '# local only\n.worktrees/uat/\n');
    if (history !== 'no-history') writeFileSync(path.join(flowRoot, 'history.md'), `# history\n\n- ${RUN} - ${COMMIT} - pass - ${APPROVAL}\n`);
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

async function expectValid(files, label, history, options = {}) {
  const { branch, session } = writeBranch(files, history);
  const { errors } = await validateUatStep(branch, undefined, options);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label, history, options = {}) {
  const { branch, session } = writeBranch(files, history);
  const { errors } = await validateUatStep(branch, undefined, options);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

await expectValid(baseline(), 'a run triggered by a chain, authorised, admitted at the pinned commit, three lanes passing');
const splitRole = () => {
  const files=baseline(), provenance={fe:COMMIT,be:OTHER_COMMIT};
  files['request/request.json'].contexts=[{alias:'@workspaces/fe',head:COMMIT},{alias:'@workspaces/be',head:OTHER_COMMIT},{alias:'@worktrees/uat/enrollment/paid-enrollment',head:null}];
  files['response/data/snapshot.json']=snapshot({provenance,admission:snapshot().admission.map(a=>({...a,role:'fe'}))});
  files['response/data/verdicts.json']=verdicts({provenance});
  files['response/response.md']=responseMd({snap:files['response/data/snapshot.json'],verd:files['response/data/verdicts.json']});
  return files;
};
await expectValid(splitRole(),'different FE/BE repositories retain their own heads and FE admissions');
const omittedFrontend=baseline();omittedFrontend['../../step-1/parallel-2/response/data/route.json']={role:'fe',sourceHead:OTHER_COMMIT};
await expectError(omittedFrontend,'requires an explicit frontend context','omitting FE context cannot conceal a distinct frontend route head');
const omittedAdmission=baseline();omittedAdmission['../../step-2/parallel-1/request/request.json']={operatorId:'quality.verify',contexts:[{alias:'@workspaces/fe',head:OTHER_COMMIT}]};
await expectError(omittedAdmission,'requires an explicit frontend context','omitting FE context cannot conceal a distinct actual admission head');
const sameRepositoryLegacy=baseline();sameRepositoryLegacy['../../step-1/parallel-2/response/data/route.json']={role:'fe',sourceHead:COMMIT};
await expectValid(sameRepositoryLegacy,'legacy shared-commit frontend/backend remains valid');
for(const [mutate,needle,label]of [
  [f=>{delete f['response/data/snapshot.json'].provenance;},'role provenance differs','missing explicit role provenance'],
  [f=>{f['response/data/snapshot.json'].provenance={fe:OTHER_COMMIT,be:COMMIT};},'role provenance differs','swapped snapshot role heads'],
  [f=>{f['response/data/verdicts.json'].provenance.be=COMMIT;},'role provenance differs','backend relabeled with frontend sha'],
  [f=>{f['response/data/snapshot.json'].admission[0].role='be';},'must admit the pinned frontend role','cross-role audit admission'],
  [f=>{f['response/data/snapshot.json'].admission[1].commit=OTHER_COMMIT;},'must admit the pinned frontend role','backend head used as frontend quality'],
  [f=>{f['../../step-2/parallel-1/request/request.json']={operatorId:'quality.verify',contexts:[{alias:'@workspaces/be',head:COMMIT}]};},'did not pin the frontend role','actual quality owner has only BE context'],
  [f=>{f['../../step-1/parallel-1/request/request.json']={operatorId:'interface.audit',contexts:[{alias:'@workspaces/fe',head:OTHER_COMMIT}]};},'did not pin the frontend role','actual audit owner pinned stale FE head'],
  [f=>{f['../../step-2/parallel-1/response/response.md']=`# quality\n\n## Binding\n\n| Field | Value |\n| --- | --- |\n| Head | ${OTHER_COMMIT} |\n| Checkout | @workspaces/fe |\n`;},'receipt names a stale or cross-role head','actual quality receipt disagrees with owner context'],
  [f=>{f['../../step-1/parallel-2/response/data/route.json']={role:'be'};},'browser route must identify the frontend role','backend endpoint cannot stand in for browser route'],
]){const f=splitRole();mutate(f);await expectError(f,needle,label);}
await expectValid(withVerdicts({ behavior: 'fail' }, { next: ['data.seed', 'backend.generate', 'user'], outcomes: { 'pay-and-enrol': 'fail', 'abandon-checkout': 'pass' } }), 'a behaviour failure routed to cleanup and the backend');
await expectValid(withVerdicts({ ux: 'fail' }, { next: ['data.seed', 'user'], outcomes: { 'pay-and-enrol': 'fail', 'abandon-checkout': 'pass' } }), 'a UX failure routed to cleanup and a person');
await expectValid(blocked(), 'blocked on a missing admission, publishing nothing', 'none');
await expectValid({ 'request/request.json': requestJson(), 'response/response.json': { schemaVersion: 9, operatorId: 'uat.verify', step: 3, parallel: 1, status: 'blocked', stop: 'IDENTITY_MISSING', fallbacks: [], fields: {}, commits: [], next: ['identity.provision'] } }, 'a flow with no account yet: handed to provisioning, which creates it', 'none');

// The gate and the run's authority.
await expectError({ ...baseline(), 'response/response.json': { ...responseJson(), stop: 'LEASE_INVALID' } }, 'only a blocked response carries a stop', 'a done branch carrying a stop');
await expectValid({ ...blocked(), 'response/response.json': { schemaVersion: 9, operatorId: 'uat.verify', step: 3, parallel: 1, status: 'blocked', stop: 'RUNTIME_UNAVAILABLE', fallbacks: [], fields: {}, commits: [], next: [] } }, 'blocked on the shared RUNTIME_UNAVAILABLE code');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { password: 'x' } }) }, 'requirements.password is not a field', 'a credential has nowhere to go in a request');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { approval: '' } }) }, 'required field approval has no value', 'a run with no authority behind it');
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
await expectError({ ...withVerdicts({ ux: 'fail' }, { next: ['data.seed', 'backend.generate'] }) }, 'it hands to a person', 'a UX failure routed away from the person');

// Evidence per case.
await expectError({ ...baseline(), 'response/response.json': responseJson({ captures: [`response/data/captures/${CASES[0]}.json`] }), [`response/data/captures/${CASES[1]}.json`]: null }, `case ${CASES[1]} has no capture registered`, 'a frozen case with no capture');
await expectError({ ...baseline(), 'response/response.json': responseJson({ shots: [`response/artifacts/${CASES[0]}.png`] }) }, `case ${CASES[1]} has no screenshot registered`, 'a frozen case with no screenshot');
await expectError({ ...baseline(), [`response/data/captures/${CASES[0]}.json`]: capture(CASES[0], { loginFieldMasked: false }) }, 'expected true', 'a capture that cannot say the login field was masked');

// A walk is evidence only for what it pressed: every assertion names the surface control it pressed,
// and the validator refuses a step with no control and a criterion scored from one, the same way it
// refuses any other missing evidence field, over the generic kind schema.
await expectError({ ...baseline(), [`response/data/captures/${CASES[0]}.json`]: capture(CASES[0], { assertions: capture(CASES[0]).assertions.map((a, i) => (i === 0 ? { assertionId: a.assertionId, lane: a.lane, observed: a.observed, evidenceRef: a.evidenceRef, outcome: a.outcome } : a)) }) }, 'assertions[0].control: required', 'a step with no control recorded for the surface it acted on');
await expectError({ ...baseline(), [`response/data/captures/${CASES[0]}.json`]: capture(CASES[0], { assertions: capture(CASES[0]).assertions.map((a, i) => (i === 1 ? { ...a, control: '' } : a)) }) }, 'assertions[1].control: string is too short', 'a criterion scored from a step whose recorded control names nothing — reaching the product past the surface it renders');
await expectError({ ...baseline(), [`response/data/captures/${CASES[0]}.json`]: capture(CASES[0], { executedAt: T(5) }) }, 'executed at or before the snapshot freeze', 'a case executed before the freeze');
await expectError({ ...baseline(), [`response/data/captures/${CASES[0]}.json`]: capture(CASES[0], { assertions: capture(CASES[0]).assertions.slice(0, 2) }) }, 'was never observed', 'a frozen assertion nobody observed');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ cases: [frozenCase(CASES[0], 1), frozenCase(CASES[1], 2)] }) }, 'contiguous order starting at 1', 'a frozen order that starts at two');
await expectError({ ...baseline(), 'request/request.json': requestJson({ cases: [CASES[0], 'ghost-case'] }) }, 'requested case ghost-case was never frozen', 'a case the snapshot never froze');

// Custody: the password may appear in nothing this operator writes.
await expectError({ ...baseline(), 'response/response.md': responseMd({ note: `The tester signed in with ${LEAK} and continued.` }) }, 'the shared UAT password appears in a file this operator writes', 'the password published in the receipt');
await expectError({ ...baseline(), [`response/data/captures/${CASES[0]}.json`]: capture(CASES[0], { assertions: [{ assertionId: 'entry', lane: 'ui', observed: `the login form held ${LEAK}`, evidenceRef: 'x', outcome: 'pass' }, { assertionId: 'commitment', lane: 'behavior', observed: 'ok', evidenceRef: 'x', outcome: 'pass' }, { assertionId: 'terminal', lane: 'behavior', observed: 'ok', evidenceRef: 'x', outcome: 'pass' }] }) }, 'the shared UAT password appears in a file this operator writes', 'the password recorded in a capture');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ accounts: [{ ...account(), password: 'x' }] }) }, 'unexpected property', 'an account record with a place to hold a secret');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ accounts: [account('learner', { credentialRef: '.stacks/local/secrets/uat.txt' })] }) }, 'string does not match', 'a credential outside the sealed file');

// Namespace and append-only history.
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ cleanup: { ...verdicts().cleanup, namespace: 'uat-anything' } }) }, 'cleanup must name the exact run fixture namespace', 'a cleanup wider than the run');
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ cleanup: { ...verdicts().cleanup, runRecordsDeleted: true } }) }, 'expected false', 'a cleanup that deleted a run record');
await expectError(baseline(), 'runs are append-only', 'a run record rewritten with another result', 'rewritten');
await expectError(baseline(), 'appends its record under runs/', 'a decided run that appended nothing', 'missing-run');
await expectError(baseline(), 'but this run published', 'a latest pointer left on another run', 'stale-latest');

// The receipt agrees with the machine record.
await expectError({ ...baseline(), 'response/response.md': responseMd().replace(`| Commit | \`${COMMIT}\` |`, `| Commit | \`${OTHER_COMMIT}\` |`) }, 'Snapshot names another commit', 'a receipt naming another commit');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('## Cases', '## Case list') }, 'missing section ^## Cases$', 'a receipt section renamed');
await expectError({ ...baseline(), 'response/response.json': responseJson({ drop: 'uat-verdicts' }) }, 'required output uat-verdicts is not in fields', 'a decided run that published no verdicts');

// The experience lane is scored, not asserted: UX-12 computes it, and the receipt copies it.
await expectValid(withVerdicts({ ux: 'fail' }, { next: ['data.seed', 'user'], outcomes: { 'pay-and-enrol': 'fail', 'abandon-checkout': 'pass' } }), 'a run whose experience lane is fix-first on a gating criterion');
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ experience: { ...experience(), mean: 5 } }) }, 'the eleven scores average 4.00', 'an experience mean nobody computed');
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ experience: { ...experience(), verdict: 'fix-first' } }) }, 'UX-12 makes it ship', 'an experience verdict UX-12 does not produce');
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ experience: { ...experience(), entries: experience().entries.slice(0, 10) } }) }, 'array is too short', 'a criterion left out of the experience lane');
await expectError({ ...baseline(), 'response/data/verdicts.json': verdicts({ experience: (() => { const l = experience(); l.entries[0] = { ...l.entries[0], verdict: 'fail', routeTo: 'none' }; l.mean = 4; l.verdict = 'fix-first'; l.routeTo = 'direction'; return l; })() }) }, 'fails UX-1 and routes nowhere', 'an experience failure that routes nowhere');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('| `experience` | ship | none |', '| `experience` | fix-first | direction |') }, 'Verdict records fix-first', 'a receipt whose experience row differs from the lane');

// The verifier freezes a planned flow and may publish the first candidate baseline it observed.
const firstRun = snapshot();
assert.equal(firstRun.flowSource, 'planned');
assert.equal(firstRun.accounts[0].provisionedBy, RUN);
assert.equal(firstRun.golden.state, 'candidate');

// A flow whose folder already stood, verified against an approved reference.
const settled = () => {
  const snap = snapshot({
    flowSource: 'planned',
    golden: { state: 'approved', ref: `${DIR}/snapshots/snapshot.json`, approvedBy: 'the product owner', env: ENV },
    accounts: [account('learner', { provisionedBy: null })],
  });
  return { ...baseline(), 'response/data/snapshot.json': snap, 'response/response.md': responseMd({ snap }), 'response/response.json': responseJson({ next: ['data.seed', 'git.publish'] }) };
};
await expectValid(settled(), 'a flow that already existed, verified against an approved reference');

// The run identifier, the environment and the accounts.
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ runId: 'run-1' }), 'response/data/verdicts.json': verdicts({ runId: 'run-1' }) }, 'is not <yyyymmdd-HHMMss>-<commit7>', 'a run identifier that names neither a moment nor a commit');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ runId: '20260110-000000-2222222' }), 'response/data/verdicts.json': verdicts({ runId: '20260110-000000-2222222' }) }, 'and the run was pinned at', 'a run identifier naming another commit than the run verified');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ golden: { state: 'candidate', ref: `${DIR}/snapshots/snapshot.json`, approvedBy: null, env: 'staging' } }) }, 'is not authority for another', 'a reference taken in another environment');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ cases: [{ ...frozenCase(CASES[0], 0), as: 'reviewer' }, frozenCase(CASES[1], 1)] }) }, 'which no frozen account carries', 'a case acting as an alias nobody provisioned');
// The host is the self-test's own: a stack lookup must not depend on where this checkout sits.
const HOST = mkdtempSync(path.join(tmpdir(), 'uat-host-'));
const declare = (env, body) => {
  mkdirSync(path.join(HOST, '.stacks', env), { recursive: true });
  const bytes = Buffer.from(JSON.stringify(body, null, 2));
  writeFileSync(path.join(HOST, '.stacks', env, 'environment.json'), bytes);
  return `.stacks/${env}/environment.json#sha256:${createHash('sha256').update(bytes).digest('hex')}`;
};
const DEV_REF = declare('dev', { schemaVersion: 9, env: 'dev', production: false });
const TIGHT_REF = declare('tight', { schemaVersion: 9, env: 'tight', production: false, authorization: { 'identity-provisioning': 'person' } });
assert.deepEqual(UAT_CLASSES, ['identity-provisioning']);
const MOVED_REF = DEV_REF.replace(/[0-9a-f]{64}$/, '9'.repeat(64));
const onHost = { hostRoot: HOST };
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { env: 'nowhere' } }) }, 'which this installation does not have', 'a run pointed at a stack nobody installed', undefined, onHost);
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ accounts: [account('learner'), account('learner')] }) }, 'is frozen twice', 'one alias with two accounts');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ accounts: [account('learner', { credentialRef: '.stacks/staging/secrets/uat.enc' })] }) }, 'resolves its credential in another environment', 'an account sealed in another environment than the run drove');
await expectError({ ...baseline(), 'response/response.json': responseJson({ next: ['data.seed', 'git.publish'] }) }, 'no run approves its own reference', 'a first baseline promoted by the run that made it');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('| Flow source | planned |', '| Flow source | committed |') }, 'frozen plan source was planned', 'a planned flow reported as another source');

// The record has to survive the machine that made it.
await expectError(baseline(), 'appends one line to the flow history', 'a run that left no history line', 'no-history');
await expectError(baseline(), 'excludes the flow folder', 'a flow folder the host repository would never track', 'ignored');

// A verdict nobody was shown is a verdict nobody read.
await expectError({ ...baseline(), 'response/response.md': responseMd({ printed: [] }) }, 'names no run summary', 'a published verdict nobody was shown');

await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ isolation: isolation({ sessionId: 's-other' }) }) }, "no run writes another session's folder", 'a run folder written for another session');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ isolation: isolation({ servedContainsCommit: false }) }) }, 'does not contain the commit this run pinned', 'a journey driven against a head that never carried this work');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ isolation: isolation({ seededIds: [`${NS}-learner`, 'shared-learner-1'] }) }) }, 'lies outside the run namespace', 'a seed that reached a row the run does not own');
await expectError({ ...baseline(), 'response/data/snapshot.json': snapshot({ isolation: isolation({ rollbackIds: ['someone-elses-row'] }) }) }, 'which this run never seeded', 'a rollback that would delete another run rows');

// Authority from the environment's own declaration, the same mechanism runtime.serve uses. A
// synthetic host holds one declaration per case; the reference a request carries is the declaration's
// path and the hash of its bytes.

const authorityBranch = ({ approval, env = ENV }) => {
  const snap = snapshot({
    approval, env,
    golden: { state: 'candidate', ref: `${DIR}/snapshots/snapshot.json`, approvedBy: null, env },
    accounts: [account('learner', { credentialRef: `.stacks/${env}/secrets/uat.enc` })],
  });
  return { ...baseline(), 'request/request.json': requestJson({ extra: { approval, env } }), 'response/data/snapshot.json': snap, 'response/response.md': responseMd({ snap }) };
};

await expectValid(authorityBranch({ approval: DEV_REF }), 'a dev walk authorised by the environment declaration itself, no approval id needed', undefined, onHost);
await expectValid(authorityBranch({ approval: APPROVAL, env: 'tight' }), 'an environment that tightened sign-in authority to person satisfied by a plain approval id', undefined, onHost);
await expectError(authorityBranch({ approval: TIGHT_REF, env: 'tight' }), 'marks identity-provisioning as person', 'an environment that tightened sign-in authority to person refusing a declaration reference', undefined, onHost);
await expectError(authorityBranch({ approval: MOVED_REF }), 'the declaration moved since it was read', 'a declaration reference whose hash no longer matches the file', undefined, onHost);
await expectError(authorityBranch({ approval: DEV_REF, env: 'tight' }), 'authorises its own environment only', 'a dev declaration offered as approval for another environment', undefined, onHost);

const scopedAdmission = { mode: 'primary-surfaces', surfaces: [{ id: 'primary', type: 'page', route: '/primary', matrixIds: ['primary-loaded'] }], deferredStates: ['empty'], coverageClaim: 'selected-surfaces' };
const scopeMd = '\n## Audit scope\n\n| Field | Value |\n| --- | --- |\n| Mode | primary-surfaces |\n| Coverage claim | selected-surfaces |\n| Deferred states | empty |\n';
for (const variation of ['valid', 'missing-snapshot-scope', 'changed-quality-scope']) {
  const files = baseline();
  files['response/data/snapshot.json'].auditScope = variation === 'missing-snapshot-scope' ? undefined : scopedAdmission;
  files['response/data/audit-scope.json'] = scopedAdmission;
  files['response/response.json'].fields['audit-scope'] = 'response/data/audit-scope.json';
  files['response/response.md'] += scopeMd;
  const { branch, session } = writeBranch(files);
  try {
    const sourceDir = path.dirname(path.join(session, AUDIT_IN));
    mkdirSync(path.join(sourceDir, 'data'), { recursive: true });
    writeFileSync(path.join(sourceDir, 'data/verdicts.json'), JSON.stringify({ auditScope: scopedAdmission }));
    const qualityDir = path.dirname(path.join(session, QUALITY_IN));
    mkdirSync(path.join(qualityDir, 'data'), { recursive: true });
    writeFileSync(path.join(qualityDir, 'data/audit-scope.json'), JSON.stringify(variation === 'changed-quality-scope' ? { ...scopedAdmission, deferredStates: [] } : scopedAdmission));
    const { errors } = await validateUatStep(branch);
    if (variation === 'valid') assert.deepEqual(errors, [], 'UAT preserves a limited UI audit without changing its frozen cases');
    else assert.ok(errors.some((error) => error.includes(variation === 'missing-snapshot-scope' ? 'frozen snapshot must retain' : 'quality admission must retain')), errors.join('\n'));
  } finally { rmSync(session, { recursive: true, force: true }); }
}

// Mode playwright: the walk is written, the runner ran it, and the receipt is held to both. One
// lawful branch carries a walk that signs in by credential name and evidences every frozen assertion
// through a role-and-name target, the runner's result beside it at the walk's digest, and captures
// whose controls are the walk's own. Each mutation below is one way a fake walk could have read like
// an honest one, and each must fail with a line that names the defect.
const ROUTE = 'http://127.0.0.1:60000/';
const WALK_ID = 'paid-enrollment-walk';
const WALK_REF = `response/data/walks/${WALK_ID}/walk.json`;
const RESULT_REF = `response/data/walks/${WALK_ID}/walk-result.json`;
const expectId = (caseId, a) => `${caseId}-${a}`;
function walkDoc() {
  const steps = [
    { id: 'open', action: 'goto', target: null, value: ROUTE },
    { id: 'user', action: 'fill', target: { role: 'textbox', name: 'Username' }, value: `uat-${FLOW}-learner` },
    { id: 'pass', action: 'fill', target: { role: 'textbox', name: 'Password' }, value: { credential: 'uat-shared' } },
    { id: 'sign-in', action: 'click', target: { role: 'button', name: 'Sign in' } },
    { id: 'landed', action: 'expect', target: null, expect: { url: '/' } },
  ];
  for (const c of CASES) {
    for (const a of ASSERTIONS[c]) steps.push({ id: expectId(c, a), action: 'expect', target: { role: 'heading', name: `${c} ${a}` }, expect: { visible: true }, assertion: { caseId: c, assertionId: a, lane: a === 'entry' ? 'ui' : 'behavior' } });
    steps.push({ id: `${c}-shot`, action: 'capture', target: null, capture: { name: c } });
  }
  return {
    schemaVersion: 9, id: WALK_ID, flow: FLOW,
    entry: { route: ROUTE, viewport: { width: 1280, height: 800, deviceScaleFactor: 1 }, colorScheme: 'light', reducedMotion: 'reduce', locale: 'en' },
    account: { alias: 'learner', credentialName: 'uat-shared', credentialRef: `.stacks/${ENV}/secrets/uat.enc` },
    run: { runId: RUN, cases: CASES.map((c, i) => ({ caseId: c, order: i + 1 })) },
    steps,
  };
}
// The result the runner would write for a walk whose every step passed. writeBranch stringifies with
// two-space indentation, so the fingerprint is taken over exactly those bytes.
function walkResult(w, { outcomes = {} } = {}) {
  return {
    schemaVersion: 9, mode: 'playwright', walkRef: WALK_REF, walkFingerprint: walkFingerprint(Buffer.from(JSON.stringify(w, null, 2))), route: ROUTE,
    outcome: 'pass', startedAt: T(19), finishedAt: T(25),
    driver: { playwright: '1.0.0', browser: 'chromium', browserVersion: '100.0.0.0', headless: true, context: { fresh: true, viewport: [1280, 800], deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce', locale: 'en' } },
    steps: w.steps.map((s) => ({ id: s.id, action: s.action, control: stepControl(w, s.id), outcome: outcomes[s.id] ?? 'pass', url: ROUTE, ms: 1 })),
    firstFailure: null,
    captures: w.steps.filter((s) => s.action === 'capture').map((s) => ({ name: s.capture.name, stepId: s.id, screenshotRef: `response/artifacts/${s.capture.name}.png`, axRef: `response/artifacts/${s.capture.name}.ax.txt`, domRef: `response/artifacts/${s.capture.name}.dom.json` })),
  };
}
const drivenCapture = (w, caseId, over = {}) => capture(caseId, {
  driver: { mode: 'playwright', walkRef: WALK_REF, resultRef: RESULT_REF },
  assertions: ASSERTIONS[caseId].map((a) => ({ assertionId: a, lane: a === 'entry' ? 'ui' : 'behavior', observed: `${stepControl(w, expectId(caseId, a))}: observed visible`, control: stepControl(w, expectId(caseId, a)), evidenceRef: `response/artifacts/${caseId}.png`, outcome: 'pass', stepId: expectId(caseId, a) })),
  ...over,
});
function playwrightFiles({ w = walkDoc(), result = walkResult(w), captures = {} } = {}) {
  const files = baseline();
  files['response/response.json'].fields['uat-walk'] = WALK_REF;
  files['response/response.json'].fields['walk-result'] = RESULT_REF;
  files[WALK_REF] = w;
  files[RESULT_REF] = result;
  for (const c of CASES) files[`response/data/captures/${c}.json`] = captures[c] ?? drivenCapture(w, c);
  return files;
}
await expectValid(playwrightFiles(), 'a walk written by the agent, run by the runner, every control the walk\'s own');
{
  const w = walkDoc(); w.steps[3].target = { css: '#sign-in' };
  await expectError(playwrightFiles({ w }), 'no unique allowed schema branch', 'a walk whose target is a selector');
}
{
  const w = walkDoc(); w.steps.splice(5, 0, { id: 'jump', action: 'goto', target: null, value: `${ROUTE}checkout` });
  await expectError(playwrightFiles({ w }), 'the walk navigates once, at step 1', 'a walk that navigates by address bar mid-flow');
}
{
  const w = walkDoc(); w.steps[2].value = 'hunter2hunter2';
  await expectError(playwrightFiles({ w }), 'with a literal value', 'a walk carrying the password as a literal');
}
{
  const w = walkDoc();
  const c = drivenCapture(w, CASES[0]); c.assertions[1].control = 'button "Pay now"';
  await expectError(playwrightFiles({ w, captures: { [CASES[0]]: c } }), 'the control is copied from the walk, never written by the agent', 'a capture whose control differs from the walk step\'s target');
}
{
  const files = playwrightFiles();
  delete files['response/response.json'].fields['uat-walk'];
  delete files[WALK_REF];
  await expectError(files, 'a capture without its walk is refused', 'a capture that names a walk the receipt does not carry');
}
{
  const files = playwrightFiles();
  delete files['response/response.json'].fields['walk-result'];
  delete files[RESULT_REF];
  await expectError(files, 'a capture whose walk nobody ran is refused', 'a walk with no result beside it');
}
await expectError(playwrightFiles({ captures: { [CASES[1]]: capture(CASES[1]) } }), 'this capture carries no driver', 'a receipt that records mode playwright with one capture the runner did not produce');
{
  const w = walkDoc(); const result = walkResult(w); w.steps[1].value = 'someone-else';
  await expectError(playwrightFiles({ w, result }), 'a walk edited after its run is a walk nobody ran', 'a walk edited after the runner hashed it');
}
{
  const w = walkDoc();
  await expectError(playwrightFiles({ w, result: walkResult(w, { outcomes: { [expectId(CASES[0], 'terminal')]: 'fail' } }) }), 'the outcome is the runner\'s', 'an assertion passed by the agent that the runner recorded as failed');
}
{
  const w = walkDoc();
  const c = drivenCapture(w, CASES[0]); delete c.assertions[0].stepId;
  await expectError(playwrightFiles({ w, captures: { [CASES[0]]: c } }), 'names no walk step', 'an assertion that names no walk step under mode playwright');
}

process.stdout.write('uat.verify self-test: admission, scope, walk and mutation checks passed\n');
