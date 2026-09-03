// Proves validate.mjs on a synthetic session branch: one conforming branch under the defaults
// (modify, reconstruct, one candidate, automatic), one three-candidate branch that takes the
// DIRECTION_CHOICE_REQUIRED fallback, one blocked on the same code under approval-required, and one
// mutation per law, each of which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateDirectionStep } from './validate.mjs';

const HEAD = '0f1e2d3c4b5a69788796a5b4c3d2e1f009182736';
const NAMES = ['one-column', 'split-view', 'stepper'];

const coverage = ({ regions = 2, actions = 1 } = {}) => ({
  directionId: 'plan-picker',
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
  selectedFails = false, rejectAll = true, references = 0, fallbacks = [],
} = {}) {
  const formed = NAMES.slice(0, candidates);
  const attacks = formed.map((id) => `| content stress | \`${id}\` | ${selectedFails && id === selected ? 'fails' : 'holds'} | the widest plan name still fits at 360px |`);
  const others = rejectAll ? formed.filter((id) => id !== selected).map((id) => `| \`${id}\` | it loses the offer above the fold on the narrow branch |`) : [];
  const refRows = references ? ['| a public plan picker | https://example.com/plans | it settles nothing about entitlement |'] : [];
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

| Source | URL | Limitation |
| --- | --- | --- |
${refRows.join('\n')}

## Images

| Slot | Why | Claim | File |
| --- | --- | --- | --- |

## Falsification

| Attack | Candidate | Verdict | Evidence |
| --- | --- | --- | --- |
${attacks.join('\n')}

## Why not the others

| Candidate | Rejected because |
| --- | --- |
${others.join('\n')}

## Fallbacks taken

| Code | Action |
| --- | --- |
${fallbacks.map((c) => `| \`${c}\` | the candidate that survived the most attacks was selected |`).join('\n')}
`;
}

const requestJson = ({ extra = {} } = {}) => ({
  schemaVersion: 9,
  operatorId: 'frontend.direction.decide',
  step: 2,
  parallel: 1,
  sessionId: 's-test',
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

const responseJson = ({ status = 'done', stop, fields, fallbacks = [], next = ['frontend.presentation.resolve'] } = {}) => ({
  schemaVersion: 9,
  operatorId: 'frontend.direction.decide',
  step: 2,
  parallel: 1,
  status,
  ...(stop ? { stop } : {}),
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
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', chain: [['1/1'], ['2/1']], steps: { '1/1': 'business.decide', '2/1': 'frontend.direction.decide' }, current: '2/1', status: 'running' }));
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
  'response/data/coverage.json': coverage(),
});

const threeCandidates = ({ policy = 'automatic', approval = null, extraResponse = {}, md = {} } = {}) => ({
  'request/request.json': requestJson({ extra: { candidates: 3, selectionPolicy: policy, approval } }),
  'response/response.json': responseJson({
    fallbacks: policy === 'automatic' ? ['DIRECTION_CHOICE_REQUIRED'] : [],
    fields: { 'frontend-direction-decision': 'response/response.md', 'ui-coverage': 'response/data/coverage.json', candidates: NAMES.map((n) => `response/artifacts/${n}.html`) },
    ...extraResponse,
  }),
  'response/response.md': responseMd({ policy, candidates: 3, fallbacks: policy === 'automatic' ? ['DIRECTION_CHOICE_REQUIRED'] : [], ...md }),
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

await expectValid(baseline(), 'defaults (modify, reconstruct, one candidate, automatic)');
await expectValid(threeCandidates(), 'three candidates, the choice taken as a fallback');
await expectValid(threeCandidates({ policy: 'approval-required', approval: 'one-column' }), 'three candidates approved by the person');
await expectValid({
  'request/request.json': requestJson({ extra: { candidates: 3, selectionPolicy: 'approval-required' } }),
  'response/response.json': responseJson({ status: 'blocked', stop: 'DIRECTION_CHOICE_REQUIRED', next: [], fields: { candidates: NAMES.map((n) => `response/artifacts/${n}.html`) } }),
  ...Object.fromEntries(NAMES.map((n) => [`response/artifacts/${n}.html`, `<!doctype html><title>${n}</title>`])),
}, 'DIRECTION_CHOICE_REQUIRED terminates under approval-required');

await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { intent: 'create' } }) }, 'intent create requires changeLevel new', 'create without new');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { candidates: 4 } }) }, 'candidates must be 1, 2 or 3', 'four candidates');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { approval: 'one-column' } }) }, 'approval is bound under automatic policy', 'approval under automatic');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { mystery: 1 } }) }, 'requirements.mystery is not a field', 'undeclared requirement');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { changeLevel: '' } }) }, 'required field changeLevel has no value', 'missing change level');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { candidates: 2 } }) }, 'more than one candidate was formed but none was rendered', 'comparison without pages');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { preview: 'yes' } }) }, 'preview was asked for but no candidate page was rendered', 'preview without a page');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fields: { 'frontend-direction-decision': 'response/response.md', 'ui-coverage': 'response/data/coverage.json', candidates: 'response/artifacts/one-column.html' } }), 'response/artifacts/one-column.html': '<!doctype html>' }, 'one candidate under no preview renders no page', 'unasked preview page');
await expectError({ ...baseline(), 'response/response.md': responseMd({ changeLevel: 'refine' }) }, 'Change level refine differs from the request', 'receipt and request disagree on the change level');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { changeLevel: 'refine' } }), 'response/response.md': responseMd({ changeLevel: 'refine' }) }, 'a refine is classified locked-refine', 'refine classified dominant');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { changeLevel: 'refine' } }), 'response/response.md': responseMd({ changeLevel: 'refine', classification: 'locked-refine', references: 1 }) }, 'a refine works from the family idioms alone', 'refine that researched');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { references: ['https://example.com/plans'] } }) }, 'the person supplied references and none of them is recorded', 'supplied reference dropped');
await expectError({ ...baseline(), 'response/response.md': responseMd({ selectedFails: true }) }, 'fails an attack, so the direction is not decided', 'selected candidate fails an attack');
await expectError({ ...threeCandidates(), 'response/response.md': responseMd({ candidates: 3, rejectAll: false, fallbacks: ['DIRECTION_CHOICE_REQUIRED'] }) }, 'is not rejected by name', 'unselected candidate not rejected');
await expectError({ ...baseline(), 'response/response.md': responseMd({ candidates: 2 }).replace('| `split-view` | it loses', '| `absent` | it loses') }, 'Falsification covers 2 candidates, the request asked for 1', 'more candidates than asked');
await expectError({ ...threeCandidates({ policy: 'approval-required', approval: 'split-view' }) }, 'but approval names split-view', 'approval names another candidate');
await expectError({ ...threeCandidates({ policy: 'approval-required' }) }, 'approval-required with no approval cannot end done', 'approval-required decided without an approval');
await expectError(withCoverage((c) => { c.regions = c.regions.slice(0, 1); }), 'COVERAGE-1: region is not covered: decision', 'region uncovered');
await expectError(withCoverage((c) => { c.actions = []; }), 'COVERAGE-1: actions must enumerate every declared action', 'actions uncovered');
await expectError(withCoverage((c) => { c.states[1].carrier = 'the offer region'; }), 'COVERAGE-1: two meanings share one carrier', 'two meanings on one carrier');
await expectError(withCoverage((c) => { c.actions[0].pendingPaths[0].settlement = ''; }), 'pending path without a settlement', 'unsettled pending path');
await expectError(withCoverage((c) => { c.directionId = 'other-picker'; }), 'differs from the receipt', 'coverage names another direction');
await expectError({ ...baseline(), 'response/data/coverage.json': null, 'response/response.json': responseJson({ fields: { 'frontend-direction-decision': 'response/response.md' } }) }, 'required output ui-coverage is not in fields', 'missing required output');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('## Observed', '## Observations') }, 'missing section ^## Observed$', 'receipt section renamed');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'DIRECTION_CHOICE_REQUIRED', next: [] }) }, 'has disposition fallback under these requirements', 'terminating on the choice under automatic');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MADE_UP_CODE', next: [] }) }, 'not a registered code', 'unknown stop code');

process.stdout.write('frontend.direction.decide self-test: 4 valid branches, 24 rejected mutations\n');
