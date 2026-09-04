// Proves validate.mjs on a synthetic session branch: one conforming branch under the defaults
// (modify, reconstruct, one candidate, automatic), three-candidate branches whose scores make one
// dominant (decided under either policy) or prove a tie (the fallback under automatic, the person
// under approval-required), the DIRECTION_CHOICE_REQUIRED stop over a proven tie, one blocked on
// REFERENCE_MISSING because no standard could be named by class, and one mutation per law, each of
// which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateDirectionStep } from './validate.mjs';

const HEAD = '0f1e2d3c4b5a69788796a5b4c3d2e1f009182736';
const NAMES = ['one-column', 'split-view', 'stepper'];
const VIEWPORTS = ['wide', 'narrow'];
const TASTE = Array.from({ length: 12 }, (_, i) => `TASTE-${i + 1}`);

// The scores over several rendered candidates. `dominant` (the default) gives the selected
// candidate a flat 4 and the others a flat 3; `tie` levels every candidate at 4; `loser` keeps the
// selected candidate's mean highest and fails it on TASTE-2 at the wide viewport, where another
// candidate scores higher, which is the second shape of a tie; `short` drops TASTE-12 from one
// candidate so the taste lens is not whole; `uneven` scores one candidate on an extra UX criterion.
// `overrides` forces specific (id, rule[, viewport]) cells to a given score/verdict afterwards, used
// to make a candidate's ## Scores row agree, or disagree, with what ## Candidate limits declares.
function scoreTable(formed, selected, shape = 'dominant', overrides = []) {
  if (formed.length < 2) return [];
  const rows = [];
  for (const id of formed) {
    for (const viewport of VIEWPORTS) {
      for (const rule of TASTE) {
        if (shape === 'short' && id === formed[1] && rule === 'TASTE-12') continue;
        let score = shape === 'tie' ? 4 : id === selected ? 4 : 3;
        let verdict = 'pass';
        if (shape === 'loser' && rule === 'TASTE-2' && viewport === 'wide') { score = id === selected ? 2 : 3; verdict = 'fail'; }
        const forced = overrides.find((o) => o.id === id && o.rule === rule && (o.viewport ?? viewport) === viewport);
        if (forced) { score = forced.score; verdict = forced.verdict; }
        rows.push(`| \`${id}\` | ${viewport} | \`${rule}\` | ${score} | ${verdict} |`);
      }
    }
    if (shape === 'uneven' && id === formed[1]) rows.push(`| \`${id}\` | wide | \`UX-9\` | 4 | pass |`);
  }
  return rows;
}

const coverage = ({ regions = 2, actions = 1 } = {}) => ({
  directionId: 'plan-picker',
  surfaceClass: 'catalog',
  actions: [{ action: 'choose a plan', pointerRoute: 'the plan card', keyboardRoute: 'tab to the card, enter', states: ['pending', 'confirmed'], pendingPaths: [{ path: 'server accepts', settlement: 'the confirmed plan replaces the picker' }] }].slice(0, actions),
  regions: [
    { region: 'offer', idiomRef: 'idioms#offer-block', compositionRef: '@grammar/core#SurfaceCard' },
    { region: 'decision', idiomRef: 'idioms#decision-bar', compositionRef: '@grammar/core#SurfaceListCard' },
  ].slice(0, regions),
  states: [{ meaning: 'empty', carrier: 'the offer region' }, { meaning: 'pending', carrier: 'the decision button' }],
  responsive: [{ branch: 'narrow', owner: 'the page shell' }],
});

function responseMd({
  intent = 'modify', changeLevel = 'reconstruct', ownerCeiling = 'surface-and-nested-layouts',
  classification = 'dominant', policy = 'automatic', selected = 'one-column', candidates = 1,
  surfaceClass = 'catalog',
  refClass = 'plan-comparison', selectedFails = false, rejectAll = true, references = changeLevel === 'refine' ? 0 : 1, fallbacks = [],
  printed = null, scores = 'dominant', winner = null, limits = [], scoreOverrides = [],
} = {}) {
  const formed = NAMES.slice(0, candidates);
  const shown = printed ?? formed;
  const scoreRows = scores === 'none' ? [] : scoreTable(formed, winner ?? (selected === '—' ? formed[0] : selected), scores, scoreOverrides);
  const printedRows = shown.flatMap((id) => ['wide', 'narrow'].map((viewport) => `| http://127.0.0.1:60000/${id}.html?viewport=${viewport} | the ${viewport} render of the candidate, shown before the decision was written |`));
  const attacks = formed.map((id) => `| content stress | \`${id}\` | ${selectedFails && id === selected ? 'fails' : 'holds'} | the widest plan name still fits at 360px |`);
  const others = rejectAll ? formed.filter((id) => id !== selected).map((id) => `| \`${id}\` | it loses the offer above the fold on the narrow branch |`) : [];
  const limitRows = limits.map(({ candidate, criterion, says }) => `| \`${candidate}\` | \`${criterion}\` | ${says} |`);
  const BT = String.fromCharCode(96);
  const refRows = references ? [`| a public plan picker | ${BT}${refClass}${BT} | https://example.com/plans | the two-column offer-then-decision ordering | it settles nothing about entitlement |`] : [];
  return `# frontend-direction-decision — plan-picker

## Decision

| Field | Value |
| --- | --- |
| Direction id | \`plan-picker\` |
| Target | \`/plans\` |
| Intent | \`${intent}\` |
| Change level | \`${changeLevel}\` |
| Owner ceiling | \`${ownerCeiling}\` |
| Classification | \`${classification}\` |
| Selection policy | \`${policy}\` |
| Selected candidate | \`${selected}\` |

## Surface class

| Class | Why |
| --- | --- |
${surfaceClass ? `| \`${surfaceClass}\` | the surface is a set of comparable offers the reader picks from |` : ''}

## Observed

| Item | Evidence |
| --- | --- |
| what the plans route renders today | \`app/plans/page.tsx:1-64@${HEAD}\` |

## UI contract

| Element | Kind | Responsibility |
| --- | --- | --- |
| \`offer\` | region | names the offer and its price |
| \`decision\` | region | carries the choice and its confirmation |
| choose a plan | action | the actor picks one plan and the surface answers |
| empty | state | no plan is offered yet |
| pending | state | the choice is settling |
| narrow | responsive | the two regions stack below the breakpoint |

## Coverage

| Concern | Enumerated |
| --- | --- |
| Actions | one action with its routes and one settled pending path |
| Regions | two regions, each with one idiom and one composition |
| States | two meanings on two carriers |
| Responsive | one branch owned by the page shell |

## References

| Standard | Class | URL | What is borrowed | Limitation |
| --- | --- | --- | --- | --- |
${refRows.join('\n')}

## Images

| Slot | Why | Claim | File |
| --- | --- | --- | --- |

## Falsification

| Attack | Candidate | Verdict | Evidence |
| --- | --- | --- | --- |
${attacks.join('\n')}

## Candidate limits

| Candidate | Criterion | Candidate says |
| --- | --- | --- |
${limitRows.join('\n')}

## Scores

| Candidate | Viewport | Criterion | Score | Verdict |
| --- | --- | --- | --- | --- |
${scoreRows.join('\n')}

## Why not the others

| Candidate | Rejected because |
| --- | --- |
${others.join('\n')}

## Printed

| Artifact | Why |
| --- | --- |
${printedRows.join('\n')}

## Fallbacks taken

| Code | Action |
| --- | --- |
${fallbacks.map((c) => `| \`${c}\` | among the tied top scorers, the candidate introducing the fewest new nodes was selected |`).join('\n')}
`;
}

const requestJson = ({ extra = {} } = {}) => ({
  schemaVersion: 9,
  operatorId: 'frontend.direction.decide',
  step: 2,
  parallel: 1,
  sessionId: 's-test',
  ...(extra.approval ? { decisionId: 'layout-direction', selectedOption: extra.approval } : {}),
  contexts: [{ alias: '@workspaces/fe', head: HEAD }, { alias: '@grammar/core', head: null }, { alias: '@knowledge/ui/composition', head: null }],
  requirements: {
    target: '/plans',
    intent: 'modify',
    changeLevel: 'reconstruct',
    ownerCeiling: 'surface-and-nested-layouts',
    candidates: 1,
    preview: 'no',
    references: [],
    selectionPolicy: 'automatic',
    approval: null,
    resume: null,
    ...extra,
  },
  inputs: { 'business-promise-authority': 'step-1/parallel-1/response/response.md' },
  resume: null,
});

const responseJson = ({ status = 'done', stop, fields, fallbacks = [], next = ['frontend.presentation.resolve'], reason, interaction } = {}) => ({
  schemaVersion: 9,
  operatorId: 'frontend.direction.decide',
  step: 2,
  parallel: 1,
  status,
  ...(stop ? { stop } : {}),
  ...(reason ? { reason } : {}),
  ...(interaction ? { interaction } : {}),
  fallbacks,
  fields: fields ?? { 'frontend-direction-decision': 'response/response.md', 'ui-coverage': 'response/data/coverage.json' },
  commits: [],
  next,
});

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'fe-direction-session-'));
  const branch = path.join(session, 'step-2', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  mkdirSync(path.join(session, 'step-1', 'parallel-1', 'response'), { recursive: true });
  writeFileSync(path.join(session, 'step-1', 'parallel-1', 'response', 'response.md'), '# business-promise-authority — plans\n');
  const approval = files['request/request.json']?.requirements?.approval;
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'starci-academy', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['1/1'], ['2/1']], steps: { '1/1': 'business.decide', '2/1': 'frontend.direction.decide' }, current: '2/1', status: 'running', ...(approval ? { choices: { 'layout-direction': { selected: approval, selectedBy: 'user', sourceRef: 'fixture:user-selected-direction' } } } : {}) }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}

// A reconstruct renders every candidate it forms, so the baseline carries its one page. A refine
// under the defaults renders nothing, and is built from the baseline by `refine()` below.
const baseline = () => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson({ fields: { 'frontend-direction-decision': 'response/response.md', 'ui-coverage': 'response/data/coverage.json', candidates: ['response/artifacts/one-column.html'] } }),
  'response/response.md': responseMd(),
  'response/data/coverage.json': coverage(),
  'response/artifacts/one-column.html': '<!doctype html><title>one-column</title>',
});

const refine = (over = {}) => ({
  ...baseline(),
  'request/request.json': requestJson({ extra: { changeLevel: 'refine' } }),
  'response/response.json': responseJson(),
  'response/response.md': responseMd({ changeLevel: 'refine', classification: 'locked-refine' }),
  'response/artifacts/one-column.html': null,
  ...over,
});

// Three rendered candidates, scored. Under the default the scores make one-column dominant and the
// operator decides under either policy; `tie` levels them, so automatic takes the fallback and
// approval-required needs the person's approval.
const threeCandidates = ({ policy = 'automatic', approval = null, tie = false, extraResponse = {}, md = {} } = {}) => ({
  'request/request.json': requestJson({ extra: { candidates: 3, selectionPolicy: policy, approval } }),
  'response/response.json': responseJson({
    fallbacks: tie && policy === 'automatic' ? ['DIRECTION_CHOICE_REQUIRED'] : [],
    fields: { 'frontend-direction-decision': 'response/response.md', 'ui-coverage': 'response/data/coverage.json', candidates: NAMES.map((n) => `response/artifacts/${n}.html`) },
    ...extraResponse,
  }),
  'response/response.md': responseMd({ policy, candidates: 3, scores: tie ? 'tie' : 'dominant', fallbacks: tie && policy === 'automatic' ? ['DIRECTION_CHOICE_REQUIRED'] : [], ...md }),
  'response/data/coverage.json': coverage(),
  ...Object.fromEntries(NAMES.map((n) => [`response/artifacts/${n}.html`, `<!doctype html><title>${n}</title>`])),
});

async function expectValid(files, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateDirectionStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateDirectionStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}
const withCoverage = (change) => { const c = coverage(); change(c); return { ...baseline(), 'response/data/coverage.json': c }; };

await expectValid(baseline(), 'defaults (modify, reconstruct, one candidate, automatic, its page rendered)');
await expectValid(refine(), 'a refine under the defaults renders no page');
await expectValid({
  ...baseline(),
  'response/response.md': responseMd({ surfaceClass: 'console' }),
  'response/data/coverage.json': { ...coverage(), surfaceClass: 'console' },
}, 'another class of the published vocabulary, declared in the receipt and carried by the coverage');
await expectValid(threeCandidates(), 'three candidates, the scores make one dominant and the operator decides');
await expectValid(threeCandidates({ tie: true }), 'three candidates level on the scores, the tie broken by the fallback');
await expectError(threeCandidates({ policy: 'approval-required' }), 'the user selects the tier', 'a dominant recommendation cannot replace a required user choice');
await expectValid(threeCandidates({ policy: 'approval-required', approval: 'one-column', tie: true }), 'three candidates level on the scores, the tie approved by the person');
// Material choices reach the person as typed options backed by rendered and scored candidates.
// A dominant recommendation does not replace a user answer.
const CHOICE_REASON = 'http://127.0.0.1:60000/ — which of the three compositions do you take?';
const printedChoice = ({ candidates = 3, printed = NAMES.slice(0, candidates), reason = CHOICE_REASON, receipt = true, scores = 'tie' } = {}) => ({
  'request/request.json': requestJson({ extra: { candidates, selectionPolicy: 'approval-required' } }),
  'response/response.json': responseJson({
    status: 'blocked',
    stop: 'DIRECTION_CHOICE_REQUIRED',
    next: [],
    reason,
    interaction: { kind: 'tier-choice', decisionId: 'layout-direction', options: NAMES.slice(0, candidates).map((id) => ({ id, label: id, tradeoff: `Distinct experience of ${id}` })) },
    fields: { ...(receipt ? { 'frontend-direction-decision': 'response/response.md', 'ui-coverage': 'response/data/coverage.json' } : {}), candidates: NAMES.slice(0, candidates).map((n) => `response/artifacts/${n}.html`) },
  }),
  ...(receipt ? { 'response/response.md': responseMd({ policy: 'approval-required', candidates, selected: '—', rejectAll: false, printed, scores }), 'response/data/coverage.json': coverage() } : {}),
  ...Object.fromEntries(NAMES.slice(0, candidates).map((n) => [`response/artifacts/${n}.html`, `<!doctype html><title>${n}</title>`])),
});
await expectValid(printedChoice(), 'DIRECTION_CHOICE_REQUIRED under approval-required over a proven tie: three candidates printed at both viewports, one question for the person');
await expectValid(printedChoice({ scores: 'loser' }), 'DIRECTION_CHOICE_REQUIRED over the other tie: the top mean loses a failed criterion to another candidate');
await expectValid({
  'request/request.json': requestJson(),
  'response/response.json': responseJson({ status: 'blocked', stop: 'REFERENCE_MISSING', next: [], fields: {} }),
}, 'a reconstruct that could name no standard by class stops with REFERENCE_MISSING');

await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { intent: 'create' } }) }, 'intent create requires changeLevel new', 'create without new');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { candidates: 4 } }) }, 'candidates must be 1, 2 or 3', 'four candidates');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { approval: 'one-column' } }) }, 'approval is bound under automatic policy', 'approval under automatic');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { mystery: 1 } }) }, 'requirements.mystery is not a field', 'undeclared requirement');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { changeLevel: '' } }) }, 'required field changeLevel has no value', 'missing change level');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { candidates: 2 } }), 'response/response.json': responseJson() }, 'more than one candidate was formed but none was rendered', 'comparison without pages');
await expectError({ ...refine(), 'request/request.json': requestJson({ extra: { changeLevel: 'refine', preview: 'yes' } }) }, 'preview was asked for but no candidate page was rendered', 'preview without a page');
await expectError(refine({ 'response/response.json': responseJson({ fields: { 'frontend-direction-decision': 'response/response.md', 'ui-coverage': 'response/data/coverage.json', candidates: 'response/artifacts/one-column.html' } }), 'response/artifacts/one-column.html': '<!doctype html>' }), 'one candidate under no preview renders no page', 'unasked preview page on a refine');
await expectError({ ...baseline(), 'response/response.json': responseJson() }, 'a reconstruct direction renders every candidate it forms', 'a reconstruct whose candidate nobody can see');
await expectError({ ...threeCandidates(), 'response/response.json': responseJson({ fields: { 'frontend-direction-decision': 'response/response.md', 'ui-coverage': 'response/data/coverage.json', candidates: ['response/artifacts/one-column.html'] } }) }, '3 formed and 1 rendered', 'a reconstruct that rendered only the candidate it liked');
await expectError({ ...baseline(), 'response/response.md': responseMd({ changeLevel: 'refine' }) }, 'Change level refine differs from the request', 'receipt and request disagree on the change level');
await expectError(refine({ 'response/response.md': responseMd({ changeLevel: 'refine' }) }), 'a refine is classified locked-refine', 'refine classified dominant');
await expectError(refine({ 'response/response.md': responseMd({ changeLevel: 'refine', classification: 'locked-refine', references: 1 }) }), 'a refine works from the family idioms alone', 'refine that researched');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { references: ['https://example.com/plans'] } }), 'response/response.md': responseMd({ references: 0 }) }, 'the person supplied references and none of them is recorded', 'supplied reference dropped');
await expectError({ ...baseline(), 'response/response.md': responseMd({ references: 0 }) }, 'names at least one reference standard by class', 'a reconstruct that named no standard');
await expectError({ ...baseline(), 'response/response.md': responseMd({ refClass: '' }) }, 'Class', 'a standard with no class');
await expectError({ ...baseline(), 'response/response.md': responseMd({ selectedFails: true }) }, 'fails an attack, so the direction is not decided', 'selected candidate fails an attack');
await expectError({ ...threeCandidates(), 'response/response.md': responseMd({ candidates: 3, rejectAll: false }) }, 'is not rejected by name', 'unselected candidate not rejected');
await expectError({ ...baseline(), 'response/response.md': responseMd({ candidates: 2 }).replace('| `split-view` | it loses', '| `absent` | it loses') }, 'Falsification covers 2 candidates, the request asked for 1', 'more candidates than asked');
await expectError({ ...threeCandidates({ policy: 'approval-required', approval: 'split-view', tie: true }) }, 'but approval names split-view', 'approval names another candidate');
await expectError({ ...threeCandidates({ policy: 'approval-required', tie: true }) }, 'approval-required with no approval cannot end done', 'approval-required decided a tie without an approval');
// Several rendered candidates are ranked, not offered: the scores are present for every one, whole
// and comparable; the dominant candidate is the one selected; a tie is recorded as the fallback it
// was, and a fallback over a dominant candidate is a choice that never existed.
await expectError({ ...threeCandidates(), 'response/response.md': responseMd({ candidates: 3, scores: 'none' }) }, '## Scores carries no row', 'three rendered candidates decided with no scores');
await expectError({ ...threeCandidates(), 'response/response.md': responseMd({ candidates: 3, selected: 'split-view', winner: 'one-column' }) }, 'the scores make one-column dominant', 'the receipt selects a candidate the scores rank below another');
await expectError({ ...threeCandidates({ tie: true }), 'response/response.md': responseMd({ candidates: 3, scores: 'dominant', fallbacks: ['DIRECTION_CHOICE_REQUIRED'] }) }, 'no choice was required', 'a fallback recorded over a dominant candidate');
await expectError({ ...threeCandidates(), 'response/response.md': responseMd({ candidates: 3, scores: 'tie' }) }, 'no candidate dominates', 'a tie decided under automatic with no fallback recorded');
await expectError({ ...threeCandidates(), 'response/response.md': responseMd({ candidates: 3, scores: 'short' }) }, 'the taste lens is scored whole', 'a candidate scored without the whole taste lens');
await expectError({ ...threeCandidates(), 'response/response.md': responseMd({ candidates: 3, scores: 'uneven' }) }, 'different criterion set', 'candidates scored on different criterion sets');
// A score is a claim about the candidate it is scored for: a candidate's own description can
// declare, under ## Candidate limits, that it does not satisfy a criterion, and ## Scores must then
// score that pairing at the failing end wherever it carries it, and carry it at all.
const SPLIT_VIEW_LIMIT = [{ candidate: 'split-view', criterion: 'TASTE-10', says: 'the empty state carries no action of its own' }];
await expectValid({ ...threeCandidates(), 'response/response.md': responseMd({ candidates: 3, limits: SPLIT_VIEW_LIMIT, scoreOverrides: [{ id: 'split-view', rule: 'TASTE-10', score: 2, verdict: 'fail' }] }) }, 'a candidate declares it does not satisfy a criterion and ## Scores fails it at every viewport it carries');
await expectError({ ...threeCandidates(), 'response/response.md': responseMd({ candidates: 3, limits: SPLIT_VIEW_LIMIT, scoreOverrides: [{ id: 'split-view', rule: 'TASTE-10', viewport: 'wide', score: 2, verdict: 'fail' }] }) }, "a score that contradicts the candidate's own description is refused", 'the same candidate scored at the passing end on the narrow viewport');
await expectError({ ...threeCandidates(), 'response/response.md': responseMd({ candidates: 3, limits: [{ candidate: 'split-view', criterion: 'UX-9', says: 'the destructive action is never confirmed inline' }] }) }, 'and ## Scores carries no row for that pairing', 'a declared non-satisfaction with no corresponding row in ## Scores');
await expectError(withCoverage((c) => { c.regions = c.regions.slice(0, 1); }), 'COVERAGE-1: region is not covered: decision', 'region uncovered');
await expectError(withCoverage((c) => { c.actions = []; }), 'COVERAGE-1: actions must enumerate every declared action', 'actions uncovered');
await expectError(withCoverage((c) => { c.states[1].carrier = 'the offer region'; }), 'COVERAGE-1: two meanings share one carrier', 'two meanings on one carrier');
await expectError(withCoverage((c) => { c.actions[0].pendingPaths[0].settlement = ''; }), 'pending path without a settlement', 'unsettled pending path');
await expectError(withCoverage((c) => { c.directionId = 'other-picker'; }), 'differs from the receipt', 'coverage names another direction');
await expectError({ ...baseline(), 'response/response.md': responseMd({ printed: [] }) }, 'was rendered and never printed', 'a candidate rendered and never put in front of the person');
await expectError({ ...threeCandidates(), 'response/response.md': responseMd({ candidates: 3, printed: ['one-column'] }) }, 'candidate split-view was rendered and never printed', 'only the favourite candidate printed');
await expectError({ ...baseline(), 'response/response.md': responseMd({ surfaceClass: '' }) }, 'Surface class', 'a decided direction that declares no surface class');
await expectError({ ...baseline(), 'response/response.md': responseMd({ surfaceClass: 'dashboard' }), 'response/data/coverage.json': { ...coverage(), surfaceClass: 'dashboard' } }, 'outside the vocabulary COVERAGE-1 Case 7 publishes', 'a class name nobody publishes');
await expectError(withCoverage((c) => { delete c.surfaceClass; }), 'surfaceClass', 'coverage with no declared class');
await expectError(withCoverage((c) => { c.surfaceClass = 'console'; }), "surfaceClass console differs from the receipt's catalog", 'receipt and coverage declare two classes');
await expectError({ ...baseline(), 'response/data/coverage.json': null, 'response/response.json': responseJson({ fields: { 'frontend-direction-decision': 'response/response.md' } }) }, 'required output ui-coverage is not in fields', 'missing required output');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('## Observed', '## Observations') }, 'missing section ^## Observed$', 'receipt section renamed');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'DIRECTION_CHOICE_REQUIRED', next: [] }) }, 'has disposition fallback under these requirements', 'terminating on the choice under automatic');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MADE_UP_CODE', next: [] }) }, 'not a registered code', 'unknown stop code');

// The hand-off to the person.
await expectError(printedChoice({ printed: [], reason: 'Accept the composition and record the density band as seeded-data-limited, or handle the density band and three family gaps first?' }), 'lists no rendered candidate', 'a choice handed over as two prose options');
await expectError(printedChoice({ candidates: 2, printed: ['one-column'] }), 'option split-view is offered and never printed', 'a two-option choice printed with one candidate');
await expectValid(printedChoice({ candidates: 2 }), 'two rendered directions are a complete tier choice');
await expectError(printedChoice({ receipt: false }), 'with no receipt', 'a choice stop that carries no receipt and so printed nothing');
await expectError(printedChoice({ reason: 'http://127.0.0.1:60000/ — one-column keeps the offer above the fold and split-view reads denser; which do you prefer, or should I refine first?' }), 'is not one question', 'a message that narrates the options instead of asking one question');
await expectValid(printedChoice({ scores: 'dominant' }), 'a recommendation does not replace the user tier choice');
await expectError(printedChoice({ scores: 'none' }), 'with no ## Scores', 'a choice handed to the person with nothing scored');

const untypedChoice = printedChoice();
const disguisedChoice = printedChoice();
disguisedChoice['response/response.json'].stop = 'INVALID_INPUT';
disguisedChoice['response/response.json'].fields = {};
await expectError(disguisedChoice, 'must use DIRECTION_CHOICE_REQUIRED', 'another stop cannot bypass visual choice evidence');
delete untypedChoice['response/response.json'].interaction;
await expectError(untypedChoice, 'needs a typed tier-choice interaction', 'a prose question cannot bypass the interaction gate');
const mismatchedChoice = printedChoice();
mismatchedChoice['response/response.json'].interaction.options[0].id = 'unrendered';
await expectError(mismatchedChoice, 'tier options must match', 'a typed option must identify its rendered candidate');
const unrecordedApproval = threeCandidates({ policy: 'approval-required', approval: 'one-column', tie: true });
delete unrecordedApproval['request/request.json'].decisionId;
delete unrecordedApproval['request/request.json'].selectedOption;
await expectError(unrecordedApproval, 'approval must match a recorded user choice', 'approval alone is not a user choice');

process.stdout.write('frontend.direction.decide self-test: lawful branches and rejected mutations passed\n');
