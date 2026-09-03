// Proves validate.mjs on a synthetic session branch: one conforming audit over two matrix entries
// (one all-pass entry, one entry whose application-owned node fails and routes back to resolve) with
// a taste lens that ships; the same audit with a taste lens that is fix-first and routes to
// direction; one blocked on EVIDENCE_MISSING with nothing captured; and one mutation per law, each
// of which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateAuditStep } from './validate.mjs';

const WIDE = 'wide-light-loaded';
const NARROW = 'narrow-light-loaded';
const MAIN = 'body>main';
const SECTION = 'body>main>section';
const CAP = (id) => `response/data/captures/${id}.json`;
const SHOT = (id) => `response/artifacts/${id}.png`;

const capture = (id) => ({
  matrixId: id,
  viewport: id === WIDE ? [1440, 900] : [390, 844],
  scheme: 'light',
  state: 'loaded',
  nodes: [
    { path: MAIN, owner: 'app', claims: ['GAP-5'], measured: { gap: id === WIDE ? '1.5rem' : '1rem' } },
    { path: SECTION, owner: 'grammar', claims: ['PADDING-4'], measured: { padding: '1rem' } },
  ],
});

// The taste lens: twelve scored criteria, each with the measurement its own rule names, and the
// arithmetic of TASTE-13 over them. `taste()` ships at a flat 4; `tasteFixFirst()` fails TASTE-2,
// one of the five gating criteria, and drops the mean to 3.83.
const TASTE_MEASURED = {
  'TASTE-1': 'the plan title outweighs the next candidate by 40%',
  'TASTE-2': 'the tallest content-free band measures 32px and separates two regions',
  'TASTE-3': 'every stacked text block resolves to x=32; both gutters measure 24px',
  'TASTE-4': 'region 48px > section 24px > row 16px at both viewports',
  'TASTE-5': 'one accent-filled call to action; four hues, all palette roles',
  'TASTE-6': 'three sizes and two weights per region; the paragraph measures 62 characters',
  'TASTE-7': 'two radius steps, one family; the deepest nesting is two cards',
  'TASTE-8': 'one image, carrying the promise subject, lighter than the focal element',
  'TASTE-9': 'content and action rectangles sum to 63% of the captured area',
  'TASTE-10': 'skeleton, empty and error hold the same regions at the same ranks',
  'TASTE-11': 'every target measures at least 44x44; hover moves nothing',
  'TASTE-12': 'sorted into the class the direction named',
};
const TASTE_RULES = Object.keys(TASTE_MEASURED);
const VOID_BAND = 'a tinted band 180px tall whose only occupant is a decorative artwork';
const taste = () => ({
  entries: TASTE_RULES.map((rule) => ({ rule, measured: TASTE_MEASURED[rule], score: 4, verdict: 'pass', routeTo: 'none' })),
  mean: 4,
  verdict: 'ship',
});
const tasteFixFirst = () => {
  const lens = taste();
  lens.entries[1] = { rule: 'TASTE-2', measured: VOID_BAND, score: 2, verdict: 'fail', routeTo: 'direction' };
  lens.mean = 3.83;
  lens.verdict = 'fix-first';
  return lens;
};

const verdicts = (lens = taste) => ({
  entries: [
    {
      matrixId: WIDE,
      surfaceClass: 'console',
      taste: lens(),
      results: [
        { path: MAIN, owner: 'app', rule: 'GAP-5', measured: '1.5rem', verdict: 'pass', routeTo: 'none' },
        { path: SECTION, owner: 'grammar', rule: 'PADDING-4', measured: '1rem', verdict: 'pass', routeTo: 'none' },
      ],
    },
    {
      matrixId: NARROW,
      surfaceClass: 'console',
      taste: lens(),
      results: [
        { path: MAIN, owner: 'app', rule: 'GAP-5', measured: '1rem', verdict: 'fail', routeTo: 'resolve' },
        { path: SECTION, owner: 'grammar', rule: 'PADDING-4', measured: '1rem', verdict: 'pass', routeTo: 'none' },
      ],
    },
  ],
});

const BT = String.fromCharCode(96);
const tasteTable = (lens) => lens.entries.map((r) => `| ${BT}${r.rule}${BT} | ${r.measured} | ${r.score} | ${r.verdict} |`).join(String.fromCharCode(10));

// Every rule this audit judges belongs to a topic, and each topic closes itself; the receipt copies
// those verdicts rather than recomputing them.
const verdictTable = (lens) => [
  ['presentation', 'fail', 'resolve'],
  ['composition', 'blocked', 'none'],
  ['responsive', 'blocked', 'none'],
  ['motion', 'blocked', 'none'],
  ['accessibility', 'blocked', 'none'],
  ['contrast', 'blocked', 'none'],
  ['render-truth', 'blocked', 'none'],
  ['taste', lens.verdict, lens.verdict === 'ship' ? 'none' : 'direction'],
].map(([topic, verdict, route]) => `| ${BT}${topic}${BT} | ${verdict} | ${route} |`).join(String.fromCharCode(10));

const responseMd = (lens = taste()) => `# frontend-surface-audit — plan-picker

## Surface class

| Class | Declared by |
| --- | --- |
| \`console\` | \`frontend-direction-decision\`, whose coverage names the class every banded rule reads |

## Matrix

| Matrix | Viewport | Scheme | State | Screenshot |
| --- | --- | --- | --- | --- |
| \`${WIDE}\` | 1440x900 | light | loaded | \`${SHOT(WIDE)}\` |
| \`${NARROW}\` | 390x844 | light | loaded | \`${SHOT(NARROW)}\` |

## Verdicts by owner

| Matrix | Owner | Node | Rule | Measured | Verdict |
| --- | --- | --- | --- | --- | --- |
| \`${WIDE}\` | app | \`${MAIN}\` | \`GAP-5\` | 1.5rem | pass |
| \`${WIDE}\` | grammar | \`${SECTION}\` | \`PADDING-4\` | 1rem | pass |
| \`${NARROW}\` | app | \`${MAIN}\` | \`GAP-5\` | 1rem | fail |
| \`${NARROW}\` | grammar | \`${SECTION}\` | \`PADDING-4\` | 1rem | pass |

## Taste

| Rule | Measured | Score | Verdict |
| --- | --- | --- | --- |
${tasteTable(lens)}

- Mean: ${lens.mean.toFixed(2)}
- Verdict: ${lens.verdict}

## Verdict

| Topic | Verdict | Route |
| --- | --- | --- |
${verdictTable(lens)}

## Regressions

| Matrix | Node | Rule | Measured | Routes to |
| --- | --- | --- | --- | --- |
| \`${NARROW}\` | \`${MAIN}\` | \`GAP-5\` | 1rem | resolve |

## Grammar gaps

| Component | Rule | What the family lacks |
| --- | --- | --- |

## Fallbacks taken

| Code | Action |
| --- | --- |
`;

const requestJson = ({ extra = {} } = {}) => ({
  schemaVersion: 9,
  operatorId: 'frontend.surface.audit',
  step: 4,
  parallel: 1,
  sessionId: 's-test',
  contexts: [{ alias: '@knowledge/ui/proof', head: null }, { alias: '@workspaces/fe', head: 'e'.repeat(40) }, { alias: '@worktrees/sessions/central-runtime', head: null }],
  requirements: { matrix: [], readinessProbe: 'route-served', resume: null, ...extra },
  inputs: {
    'frontend-source-application': 'step-3/parallel-1/response/response.md',
    'frontend-presentation-resolution': 'step-2/parallel-1/response/response.md',
    'frontend-direction-decision': 'step-1/parallel-1/response/response.md',
  },
  resume: null,
});

const responseJson = ({ status = 'done', stop, fields, next = ['frontend.presentation.resolve'] } = {}) => ({
  schemaVersion: 9,
  operatorId: 'frontend.surface.audit',
  step: 4,
  parallel: 1,
  status,
  ...(stop ? { stop } : {}),
  fallbacks: [],
  fields: fields ?? {
    'frontend-surface-audit': 'response/response.md',
    verdicts: 'response/data/verdicts.json',
    capture: [CAP(WIDE), CAP(NARROW)],
    screenshot: [SHOT(WIDE), SHOT(NARROW)],
  },
  commits: [],
  next,
});

function writeBranch(files, { decisionClass = 'console' } = {}) {
  const session = mkdtempSync(path.join(tmpdir(), 'fe-audit-session-'));
  const branch = path.join(session, 'step-4', 'parallel-1');
  for (const d of ['request', 'response/data/captures', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  for (const [step, name] of [[1, 'frontend-direction-decision'], [2, 'frontend-presentation-resolution'], [3, 'frontend-source-application']]) {
    const dir = path.join(session, `step-${step}`, 'parallel-1', 'response');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'response.md'), `# ${name} — plan-picker\n`);
  }
  // The class this audit carries is the one the direction decided; the coverage beside that receipt
  // is where it is read from, and a decision written before the class was declared carries none.
  mkdirSync(path.join(session, 'step-1', 'parallel-1', 'response', 'data'), { recursive: true });
  writeFileSync(
    path.join(session, 'step-1', 'parallel-1', 'response', 'data', 'coverage.json'),
    JSON.stringify({ directionId: 'plan-picker', ...(decisionClass ? { surfaceClass: decisionClass } : {}), actions: [], regions: [], states: [], responsive: [] }, null, 2),
  );
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'starci-academy', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['3/1'], ['4/1']], steps: { '3/1': 'frontend.source.apply', '4/1': 'frontend.surface.audit' }, current: '4/1', status: 'running' }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}

const baseline = () => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': responseMd(),
  'response/data/verdicts.json': verdicts(),
  [CAP(WIDE)]: capture(WIDE),
  [CAP(NARROW)]: capture(NARROW),
  [SHOT(WIDE)]: 'PNG',
  [SHOT(NARROW)]: 'PNG',
});

async function expectValid(files, label, options) {
  const { branch, session } = writeBranch(files, options);
  const { errors } = await validateAuditStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label, options) {
  const { branch, session } = writeBranch(files, options);
  const { errors } = await validateAuditStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}
const mutate = (change) => { const v = verdicts(); change(v); return { ...baseline(), 'response/data/verdicts.json': v }; };

// The same audit under a taste lens that fails TASTE-2: the composition is decided again, and the
// checkout's own gates wait, so next names direction and never quality.verify.
const fixFirst = (extra = {}) => ({
  ...baseline(),
  'response/data/verdicts.json': verdicts(tasteFixFirst),
  'response/response.md': responseMd(tasteFixFirst()),
  'response/response.json': responseJson({ next: ['frontend.presentation.resolve', 'frontend.direction.decide'] }),
  ...extra,
});

await expectValid(baseline(), 'two entries: one all-pass, one application-owned failure routed back to resolve');
await expectValid(fixFirst(), 'the canon lane holds where it can and the taste lens is fix-first, routed to direction');
await expectValid({ 'request/request.json': requestJson(), 'response/response.json': responseJson({ status: 'blocked', stop: 'EVIDENCE_MISSING', next: [], fields: {} }) }, 'blocked on EVIDENCE_MISSING with nothing captured');
await expectValid({ 'request/request.json': requestJson(), 'response/response.json': responseJson({ status: 'blocked', stop: 'IDENTITY_MISSING', next: ['platform.operate'], fields: {} }) }, 'a guarded route with no account yet: handed to provisioning, not reported as an unavailable runtime');

await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { mystery: 1 } }) }, 'requirements.mystery is not a field', 'undeclared requirement');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { matrix: [{ matrixId: WIDE }] } }) }, 'the request narrowed the matrix without it', 'entry judged outside the narrowed matrix');
await expectError(mutate((v) => { v.entries[1].results[0].routeTo = 'none'; }), 'fails and routes nowhere', 'failure that routes nowhere');
await expectError(mutate((v) => { v.entries[1].results[0].routeTo = 'grammar-gap'; }), 'application-owned and its failure must route to resolve', 'application failure sent to the family');
await expectError(mutate((v) => { v.entries[1].results[1].verdict = 'fail'; v.entries[1].results[1].routeTo = 'resolve'; }), "a failure there is a grammar-gap, never a resolve loop", 'Grammar failure sent into the resolve loop');
await expectError(mutate((v) => { v.entries[0].results[0].routeTo = 'resolve'; }), 'passes and still routes to resolve', 'passing node that routes somewhere');
await expectError(mutate((v) => { v.entries[1].results[0].rule = 'GAP-4'; }), 'which that node never claimed', 'judged on a rule nobody claimed');
await expectError(mutate((v) => { v.entries[0].results[0].measured = '2rem'; }), 'which the capture did not measure', 'judged against a value nobody measured');
await expectError(mutate((v) => { v.entries[0].results[0].owner = 'grammar'; }), 'in the capture', 'owner differs from the capture');
await expectError(mutate((v) => { v.entries[0].results.push({ path: 'body>footer', owner: 'app', rule: 'GAP-1', measured: '0.25rem', verdict: 'pass', routeTo: 'none' }); }), 'was never measured there', 'verdict without a measurement');
await expectError(mutate((v) => { v.entries[0].results = [v.entries[0].results[0]]; }), 'and no verdict judges it', 'claim left unjudged');
await expectError(mutate((v) => { v.entries.push({ ...v.entries[0] }); }), 'is judged twice', 'one entry judged twice');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fields: { 'frontend-surface-audit': 'response/response.md', verdicts: 'response/data/verdicts.json', capture: [CAP(WIDE), CAP(NARROW)], screenshot: [SHOT(WIDE)] } }) }, 'has verdicts and no screenshot', 'entry without a screenshot');
await expectError({ ...baseline(), 'response/response.json': responseJson({ next: ['quality.verify'] }) }, 'so next names frontend.presentation.resolve', 'failure that never reaches the resolver');
await expectError({ ...baseline(), [CAP(NARROW)]: { ...capture(NARROW), viewport: [1440, 900] } }, 'in the capture', 'receipt and capture disagree on the viewport');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('| 1rem | fail |', '| 1rem | pass |') }, 'is pass here and fail in the verdicts', 'receipt hides a failure');
const dropRegression = (text) => text.split(String.fromCharCode(10)).filter((l) => !l.startsWith('| `narrow-light-loaded` | `body>main`')).join(String.fromCharCode(10));
await expectError({ ...baseline(), 'response/response.md': dropRegression(responseMd()) }, 'Regressions has 0 rows, the verdicts carry 1 failures', 'regression dropped from the receipt');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('## Grammar gaps', '## Gaps') }, 'missing section ^## Grammar gaps$', 'receipt section renamed');
await expectError({ ...baseline(), 'response/data/verdicts.json': null, 'response/response.json': responseJson({ fields: { 'frontend-surface-audit': 'response/response.md', capture: [CAP(WIDE), CAP(NARROW)], screenshot: [SHOT(WIDE), SHOT(NARROW)] } }) }, 'required output verdicts is not in fields', 'missing required output');
await expectError({ ...baseline(), [CAP(WIDE)]: { ...capture(WIDE), viewport: [10, 10] } }, 'viewport', 'capture schema');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MADE_UP_CODE', next: [] }) }, 'not a registered code', 'unknown stop code');

// The taste lens.
await expectError(mutate((v) => { delete v.entries[0].taste; }), 'carries no taste block', 'a done audit that publishes only the canon lens');
await expectError(mutate((v) => { v.entries[0].taste.entries.splice(6, 1); }), 'leaves TASTE-7 unscored', 'a criterion left out of the lens');
await expectError(mutate((v) => { v.entries[0].taste.mean = 5; }), 'the twelve scores average 4.00', 'a mean nobody computed');
await expectError(mutate((v) => { v.entries[0].taste.verdict = 'fix-first'; }), 'TASTE-13 makes it ship', 'a verdict TASTE-13 does not produce');
await expectError(mutate((v) => { v.entries[0].taste.entries[0].verdict = 'fail'; v.entries[0].taste.entries[0].routeTo = 'resolve'; }), 'routeTo', 'a taste failure sent into the resolve loop');
await expectError(mutate((v) => { v.entries[0].taste.entries[0].verdict = 'fail'; }), 'a taste failure routes to direction, never to resolve', 'a taste failure that routes nowhere');
await expectError(fixFirst({ 'response/response.json': responseJson({ next: ['frontend.presentation.resolve', 'quality.verify'] }) }), 'quality.verify follows a ship', 'a fix-first surface sent to the gates');
await expectError(fixFirst({ 'response/response.json': responseJson({ next: ['frontend.presentation.resolve'] }) }), 'the taste lens is fix-first, so next names frontend.direction.decide', 'a fix-first lens that never reaches the direction');
await expectError(fixFirst({ 'response/response.md': responseMd() }), 'TASTE-2 is pass here and fail in the verdicts', 'receipt hides a taste failure');

// The surface class and the per-topic verdict rows.
await expectError(mutate((v) => { v.entries[1].surfaceClass = 'landing'; }), 'one surface has one class', 'two classes over one surface');
await expectError(mutate((v) => { delete v.entries[0].surfaceClass; }), 'surfaceClass', 'an entry with no declared class');
await expectError(baseline(), 'declares no surface class', 'a direction decision written before the class was declared', { decisionClass: null });
await expectError(baseline(), "the entries carry console and the direction's coverage declares landing", 'an audit that banded the surface by a class the direction never decided', { decisionClass: 'landing' });
await expectError({ ...baseline(), 'response/response.md': responseMd().replace(`| ${BT}presentation${BT} | fail | resolve |`, `| ${BT}presentation${BT} | pass | none |`) }, 'Verdict records pass for presentation', 'a Verdict row that hides a failing topic');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace(`| ${BT}contrast${BT} | blocked | none |`, `| ${BT}contrast${BT} | pass | none |`) }, 'Verdict records pass for contrast', 'a topic passed on evidence nobody took');

process.stdout.write('frontend.surface.audit self-test: 4 valid branches, 36 rejected mutations\n');
