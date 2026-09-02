// Proves validate.mjs on a synthetic session branch: one conforming unit under the defaults with its
// review exchange, one unit with an image and two tracks, one unit that spent the revision fallback,
// one branch blocked on a terminate code, one branch waiting for the review, and one mutation per law,
// each of which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateContentStep } from './validate.mjs';

const head = 'a'.repeat(40);
const fp = (c) => `sha256:${c.repeat(64)}`;
const UNIT = 'idempotent-writes';
const BRIEF_FP = fp('b');
const OUTCOMES = ['explain-idempotency', 'apply-request-token'];
const CLAIMS = ['retry-is-safe'];
const ARTICLE = (language) => `response/artifacts/article.${language}.md`;
const TRACK = { typescript: 'response/artifacts/track.typescript.ts', go: 'response/artifacts/track.go.go' };
const IMAGE = 'response/artifacts/image.retry.png';
const PROMPT = 'response/artifacts/prompt.retry.txt';
const COMMANDS = [
  { language: 'typescript', buildCommand: 'build-typescript', checkCommand: 'check-typescript' },
  { language: 'go', buildCommand: 'build-go', checkCommand: 'check-go' },
];

const e2eJson = (overrides = {}) => ({
  unitId: UNIT, contractFingerprintBefore: fp('c'), contractFingerprintAfter: fp('c'), iterations: 1, maxIterations: 2,
  tracks: COMMANDS.map((c) => ({ language: c.language, sourceRef: TRACK[c.language], buildCommand: c.buildCommand, exitCode: 0 })),
  runs: COMMANDS.map((c) => ({ language: c.language, command: c.checkCommand, exitCode: 0, assertions: [{ name: `${c.language}-retry-is-safe`, held: true }] })),
  ...overrides,
});

const briefMd = ({ fingerprint = BRIEF_FP, outcomes = OUTCOMES, claims = CLAIMS, dispositions = [['add', '—', 'this unit adds the idempotent write lesson']] } = {}) => `# content-brief — ${UNIT}

The unit that teaches a learner why a retried write is safe.

## Binding

| Field | Value |
| --- | --- |
| Unit | ${UNIT} |
| Objective | teach idempotent writes |
| Audience | backend learners past the transactions unit |
| Fingerprint | ${fingerprint} |

## Learner inputs

| Input | Statement |
| --- | --- |
| transactions | the learner already knows what a transaction is |

## Outcomes

| Outcome | Statement |
| --- | --- |
${outcomes.map((id) => `| \`${id}\` | what the learner can do: ${id} |`).join('\n')}

## Claims

| Claim | Statement |
| --- | --- |
${claims.map((id) => `| \`${id}\` | the statement the visual may encode: ${id} |`).join('\n')}

## Examples

| Example | Statement |
| --- | --- |
| retry-example | the same request token applied twice |

## Dispositions

| Kind | Target | Statement |
| --- | --- | --- |
${dispositions.map(([kind, target, statement]) => `| ${kind} | ${target} | ${statement} |`).join('\n')}
`;

const reviewMd = ({ received = [ARTICLE('vi')], scores = [90, 88, 86, 92, '—', '—', '—'], findings = [['write', 'improvement', 'one section could open faster', `${ARTICLE('vi')}:20`]], verdict = 'approved', inherited = 'none', rationale = 'withheld', reviewer = 'exec://review-1', round = 1 } = {}) => `# content-review — ${UNIT}

The reviewer read the produced artifacts and nothing else.

## Execution

| Field | Value |
| --- | --- |
| Reviewer execution | ${reviewer} |
| Inherited turns | ${inherited} |
| Producer rationale | ${rationale} |
| Round | ${round} |

## Received

| Artifact | Kind |
| --- | --- |
${received.map((ref) => `| ${ref} | ${ref.includes('article') ? 'article' : ref.includes('image') ? 'image' : ref.includes('prompt') ? 'prompt' : 'track'} |`).join('\n')}

## Scores

| Dimension | Score |
| --- | --- |
${['correctness', 'pedagogy', 'interview-value', 'language', 'visual-fidelity', 'code-quality', 'e2e-proof'].map((d, i) => `| ${d} | ${scores[i]} |`).join('\n')}

## Findings

| Owning stage | Severity | Statement | Evidence |
| --- | --- | --- | --- |
${findings.map(([stage, severity, statement, evidence]) => `| ${stage} | ${severity} | ${statement} | ${evidence} |`).join('\n')}

## Verdict

| Field | Value |
| --- | --- |
| Verdict | ${verdict} |
`;

const receiptMd = ({ verdict = 'approved', round = 1, editions = [['vi', ARTICLE('vi'), OUTCOMES]], approved = [ARTICLE('vi')], disabled = ['image', 'code', 'e2e'], briefFingerprint = BRIEF_FP, fallbacks = [] } = {}) => `# content-generation-receipt — ${UNIT}

The unit was built against a frozen brief and read by an independent review.

## Binding

| Field | Value |
| --- | --- |
| Unit | ${UNIT} |
| Brief fingerprint | ${briefFingerprint} |
| Verdict | ${verdict} |
| Round | ${round} |
| Source head | ${head} |

## Editions

| Language | Article | Outcomes covered |
| --- | --- | --- |
${editions.map(([language, ref, covered]) => `| ${language} | ${ref} | ${covered.join(', ')} |`).join('\n')}

## Approved artifacts

| Artifact | Stage |
| --- | --- |
${approved.map((ref) => `| ${ref} | ${ref.includes('article') ? 'write' : ref.includes('image') || ref.includes('prompt') ? 'image' : 'code'} |`).join('\n')}

## Findings

| Code | Stage | Ref | Statement |
| --- | --- | --- | --- |
${disabled.map((stage) => `| \`STAGE_DISABLED\` | ${stage} | — | the ${stage} stage never ran for this unit |`).join('\n')}${disabled.length ? '\n' : ''}
## Fallbacks taken

| Code | Action |
| --- | --- |
${fallbacks.map(([code, action]) => `| \`${code}\` | ${action} |`).join('\n')}${fallbacks.length ? '\n' : ''}`;

const requestJson = ({ extra = {} } = {}) => ({
  schemaVersion: 9, operatorId: 'content.generate', step: 1, parallel: 1, sessionId: 's-test',
  contexts: [{ alias: '@remote/minio/idempotent-writes/vi', head: null }, { alias: '@worktrees/sessions/central-runtime', head: null }],
  requirements: {
    unit: UNIT, naturalLanguages: ['vi'], implementationLanguages: [], stageModes: { image: 'off' },
    commands: [], maxE2eIterations: 2, maxReviewRounds: 2, resume: null, ...extra,
  },
  inputs: {}, resume: null,
});
const reviewRequest = (inputs = { article: 'step-1/parallel-1/response/artifacts/article.vi.md' }) => ({ schemaVersion: 9, operatorId: 'content.generate', step: 1, parallel: 1, sessionId: 's-test', exchange: 'review', contexts: [], requirements: {}, inputs, resume: null });
const reviewResponse = () => ({ schemaVersion: 9, operatorId: 'content.generate', step: 1, parallel: 1, exchange: 'review', status: 'done', fallbacks: [], fields: { 'content-review': 'response/review.md' }, commits: [], next: [] });
function responseJson({ status = 'done', stop, fallbacks = [], fields = null, next = [] } = {}) {
  return {
    schemaVersion: 9, operatorId: 'content.generate', step: 1, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks,
    fields: fields ?? {
      'content-generation-receipt': 'response/response.md',
      'content-brief': 'response/brief.md',
      article: [ARTICLE('vi')],
    },
    commits: [], next,
  };
}

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'content-session-'));
  const branch = path.join(session, 'step-1', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts', 'review/request', 'review/response']) mkdirSync(path.join(branch, d), { recursive: true });
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', chain: [['1/1']], steps: { '1/1': 'content.generate' }, current: '1/1', status: 'running' }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}
const baseline = () => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': receiptMd(),
  'response/brief.md': briefMd(),
  [ARTICLE('vi')]: 'the vietnamese edition',
  'review/request/request.json': reviewRequest(),
  'review/response/response.json': reviewResponse(),
  'review/response/review.md': reviewMd(),
});

async function expectValid(files, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateContentStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateContentStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}

const FULL_REFS = [ARTICLE('vi'), TRACK.typescript, TRACK.go, IMAGE, PROMPT];
const fullFields = () => ({
  'content-generation-receipt': 'response/response.md',
  'content-brief': 'response/brief.md',
  e2e: 'response/data/e2e.json',
  article: [ARTICLE('vi')],
  image: [IMAGE],
  'image-prompt': [PROMPT],
  track: [TRACK.typescript, TRACK.go],
});
const fullUnit = (overrides = {}) => {
  const files = {
    ...baseline(),
    'request/request.json': requestJson({ extra: { implementationLanguages: ['typescript', 'go'], stageModes: { image: 'on' }, commands: COMMANDS } }),
    'response/data/e2e.json': e2eJson(),
    'response/response.json': responseJson({ fields: fullFields() }),
    'response/response.md': receiptMd({ approved: [ARTICLE('vi'), IMAGE], disabled: [] }),
    'review/response/review.md': reviewMd({ received: FULL_REFS, scores: [90, 88, 86, 92, 91, 89, 90] }),
  };
  for (const ref of FULL_REFS) files[ref] = 'artifact';
  return { ...files, ...overrides };
};
const revised = () => ({
  ...baseline(),
  'response/response.json': responseJson({ fallbacks: ['REVIEW_REVISION_REQUIRED'] }),
  'response/response.md': receiptMd({ round: 2, fallbacks: [['REVIEW_REVISION_REQUIRED', 'the write stage was repaired and the review exchange was reopened']] }),
  'review/response/review.md': reviewMd({ round: 2 }),
});

await expectValid(baseline(), 'the defaults: one Vietnamese edition and its review');
await expectValid(fullUnit(), 'an image, two tracks and their executable check');
await expectValid(revised(), 'a second round after the revision fallback');
await expectValid({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'OUTCOME_UNCOVERED', fields: {} }), 'response/response.md': null, 'response/brief.md': null, 'review/request/request.json': null, 'review/response/response.json': null, 'review/response/review.md': null }, 'blocked on an uncovered outcome');
await expectValid({ ...baseline(), 'response/response.json': { ...responseJson(), status: 'waiting', awaiting: { exchange: 'review', kind: 'content-review' }, fields: { 'content-brief': 'response/brief.md', article: [ARTICLE('vi')] } }, 'response/response.md': null, 'review/request/request.json': null, 'review/response/response.json': null, 'review/response/review.md': null }, 'waiting for the review');

await expectError({ ...baseline(), 'response/response.json': { ...responseJson(), stop: 'E2E_FAILED' } }, 'only a blocked response carries a stop', 'done with a stop');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MADE_UP_CODE', fields: {} }), 'response/response.md': null, 'response/brief.md': null, 'review/request/request.json': null, 'review/response/response.json': null, 'review/response/review.md': null }, 'not a registered code', 'unknown stop code');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fallbacks: ['E2E_FAILED'] }) }, 'has disposition terminate under these requirements; it cannot be taken as a fallback', 'fallback on a terminate code');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'BRIEF_UNBOUND' }) }, 'a blocked branch carries no unit', 'blocked while carrying a unit');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { mystery: 1 } }) }, 'requirements.mystery is not a field', 'undeclared requirement');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { unit: '' } }) }, 'required field unit has no value', 'missing required unit');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { naturalLanguages: [] } }) }, 'a unit is written in at least one natural language', 'a unit in no language');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { commands: COMMANDS } }) }, 'commands must cover exactly the declared implementationLanguages', 'commands for code nobody writes');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { implementationLanguages: ['typescript'], commands: COMMANDS } }) }, 'commands must cover exactly the declared implementationLanguages', 'a command for an undeclared language');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fields: { ...responseJson().fields, article: [ARTICLE('vi'), ARTICLE('en')] } }), [ARTICLE('en')]: 'the english edition' }, 'must cover exactly the declared natural languages', 'an edition in an undeclared language');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fields: { ...responseJson().fields, image: [IMAGE] } }), [IMAGE]: 'artifact' }, 'stageModes turns the image off, so no image and no prompt may be produced', 'an image from a stage that is off');
await expectError(fullUnit({ 'response/response.json': responseJson({ fields: (() => { const f = fullFields(); delete f.image; delete f['image-prompt']; return f; })() }), 'response/response.md': receiptMd({ approved: [ARTICLE('vi')], disabled: [] }), 'review/response/review.md': reviewMd({ received: [ARTICLE('vi'), TRACK.typescript, TRACK.go], scores: [90, 88, 86, 92, 91, 89, 90] }) }), 'stageModes turns the image on', 'an image stage that produced nothing');
await expectError({ ...baseline(), 'response/data/e2e.json': e2eJson(), 'response/response.json': responseJson({ fields: { ...responseJson().fields, e2e: 'response/data/e2e.json' } }) }, 'no implementation language is declared, so nothing was built and nothing ran', 'an executable record with no code');
await expectError(fullUnit({ 'response/response.json': responseJson({ fields: (() => { const f = fullFields(); delete f.e2e; return f; })() }) }), 'a unit that ships code ships the record of building and running it', 'code with no executable record');
await expectError(fullUnit({ 'response/data/e2e.json': e2eJson({ contractFingerprintAfter: fp('d') }) }), 'the executable contract changed during the repair loop', 'a contract moved during repair');
await expectError(fullUnit({ 'response/data/e2e.json': e2eJson({ iterations: 3 }) }), 'past the bound of 2', 'a repair loop past its bound');
await expectError(fullUnit({ 'response/data/e2e.json': e2eJson({ maxIterations: 4 }) }), 'maxIterations 4 differs from the request', 'an iteration bound nobody approved');
await expectError(fullUnit({ 'response/data/e2e.json': e2eJson({ tracks: e2eJson().tracks.map((t) => (t.language === 'go' ? { ...t, exitCode: 2 } : t)) }) }), 'exits 2 and cannot be shipped as working code', 'a track that does not build');
await expectError(fullUnit({ 'response/data/e2e.json': e2eJson({ runs: [e2eJson().runs[0]] }) }), 'every implementation track must be exercised by the executable check', 'a track never exercised');
await expectError(fullUnit({ 'response/data/e2e.json': e2eJson({ runs: e2eJson().runs.map((r) => (r.language === 'go' ? { ...r, exitCode: 1 } : r)) }) }), 'executable check exits 1 and proves nothing', 'a failing executable check');
await expectError(fullUnit({ 'response/data/e2e.json': e2eJson({ runs: e2eJson().runs.map((r) => (r.language === 'go' ? { ...r, assertions: [{ name: 'go-retry-is-safe', held: false }] } : r)) }) }), 'did not hold, so the check proves nothing', 'an assertion that did not hold');
await expectError(fullUnit({ 'response/data/e2e.json': e2eJson({ runs: e2eJson().runs.map((r) => (r.language === 'go' ? { ...r, command: 'go test ./...' } : r)) }) }), 'the request declared check-go', 'a check that ran another command');
await expectError({ ...baseline(), 'review/response/review.md': reviewMd({ inherited: 'producer thread' }) }, 'no inherited turns', 'a review that inherited turns');
await expectError({ ...baseline(), 'review/response/review.md': reviewMd({ rationale: 'received' }) }, "may not receive the producer's rationale", 'a review given the rationale');
await expectError({ ...baseline(), 'review/response/review.md': reviewMd({ received: [] }) }, 'the review never received', 'an artifact nobody reviewed');
await expectError({ ...baseline(), 'review/response/review.md': reviewMd({ scores: [90, 84, 86, 92, '—', '—', '—'] }) }, 'while a score sits at 84, below 85', 'approval below the minimum score');
await expectError({ ...baseline(), 'review/response/review.md': reviewMd({ findings: [['write', 'error', 'the second outcome is wrong', `${ARTICLE('vi')}:40`]] }) }, 'while an error finding remains open', 'approval with an open error finding');
await expectError({ ...baseline(), 'review/response/review.md': reviewMd({ verdict: 'revision', findings: [['write', 'improvement', 'nothing serious', `${ARTICLE('vi')}:40`]] }) }, 'a revision verdict must name at least one error finding', 'a revision with no error finding');
await expectError({ ...baseline(), 'review/response/review.md': reviewMd({ findings: [['code', 'improvement', 'the track could be shorter', 'x']] }) }, 'cannot be assigned to the code stage, which never ran', 'a finding on a stage that never ran');
await expectError({ ...baseline(), 'review/response/review.md': reviewMd({ verdict: 'revision', findings: [['write', 'error', 'the second outcome is wrong', `${ARTICLE('vi')}:40`]] }), 'response/response.md': receiptMd({ verdict: 'revision' }) }, 'while the independent review demands a revision', 'shipping against a revision verdict');
await expectError({ ...baseline(), 'review/response/review.md': reviewMd({ round: 3 }), 'response/response.md': receiptMd({ round: 3 }), 'response/response.json': responseJson({ fallbacks: ['REVIEW_REVISION_REQUIRED'] }) }, 'past the approved maxReviewRounds of 2', 'a round past the approved rounds');
await expectError({ ...revised(), 'response/response.json': responseJson() }, 'the REVIEW_REVISION_REQUIRED fallback that reopened the exchange must be recorded', 'a second round nobody recorded');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fallbacks: ['REVIEW_REVISION_REQUIRED'] }), 'response/response.md': receiptMd({ fallbacks: [['REVIEW_REVISION_REQUIRED', 'the write stage was repaired']] }) }, 'so the review that answered it is at least the second round', 'a revision fallback with no second round');
await expectError({ ...baseline(), 'response/brief.md': briefMd({ dispositions: [['change', '—', 'this unit changes something unnamed']] }) }, 'a change disposition must name what it acts on', 'a disposition with no target');
await expectError({ ...baseline(), 'response/response.md': receiptMd({ briefFingerprint: fp('9') }) }, 'Brief fingerprint differs from the frozen brief', 'a receipt measured against another brief');
await expectError({ ...baseline(), 'response/response.md': receiptMd({ editions: [['vi', ARTICLE('vi'), [OUTCOMES[0]]]] }) }, 'leaves published outcome apply-request-token uncovered', 'an edition covering half the brief');
await expectError({ ...baseline(), 'response/response.md': receiptMd({ editions: [['vi', ARTICLE('vi'), [...OUTCOMES, 'invented-outcome']]] }) }, 'which the brief never published', 'an edition claiming an unpublished outcome');
await expectError({ ...baseline(), 'response/response.md': receiptMd({ disabled: ['image', 'code'] }) }, 'the e2e stage never ran and must be recorded as a STAGE_DISABLED finding', 'a stage that never ran and left no record');
await expectError({ ...baseline(), 'response/response.md': receiptMd({ approved: [] }) }, 'must name the artifacts the review approved', 'a generated unit approving nothing');
await expectError({ ...baseline(), 'response/response.md': receiptMd().replace('## Editions', '## Articles') }, 'missing section ^## Editions$', 'response section renamed');
await expectError({ ...baseline(), 'review/request/request.json': null, 'review/response/response.json': null, 'review/response/review.md': null }, 'the branch is done, but it never ran', 'done without the review exchange');
await expectError({ ...baseline(), 'response/response.json': (() => { const o = responseJson(); delete o.fields['content-brief']; return o; })() }, 'required output content-brief is not in fields', 'missing required output');

process.stdout.write('content.generate self-test: 5 valid branches, 38 rejected mutations\n');
