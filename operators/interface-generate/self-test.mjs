// Proves validate.mjs on a synthetic session branch that carries all three receipts of one generated
// surface: the direction (one conforming branch under the defaults — modify, reconstruct, one
// candidate, automatic — three-candidate branches whose scores make one dominant or prove a tie, the
// DIRECTION_CHOICE_REQUIRED stop over a proven tie, one blocked on REFERENCE_MISSING), the resolution
// (a three-node tree with one application-owned gap, one Grammar-owned padding and one recorded gap;
// contract emission off; a gap rule that claims no attribute; a copy-only change under Presentation
// delta none; one blocked on RULE_MISSING before anything was written) and the application (one
// modified path, one application-owned leaf created, one path unchanged; a dry run that commits
// nothing; one blocked on WRITE_REJECTED with nothing written), and one mutation per law of each of
// the three, each of which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateGenerateStep, fingerprintOf } from './validate.mjs';
import { writeUiKnowledgeFixture } from '../../tests/support/ui-knowledge-fixture.mjs';

const HEAD = '0f1e2d3c4b5a69788796a5b4c3d2e1f009182736';
const COMMIT = '9a8b7c6d5e4f30211203344556677889900aabbc';
const SESSION = 's-test';
const NAMES = ['one-column', 'split-view', 'stepper'];
const VIEWPORTS = ['wide', 'narrow'];
const TASTE = Array.from({ length: 12 }, (_, i) => `TASTE-${i + 1}`);
const BT = String.fromCharCode(96);
const fp = (c) => `sha256:${c.repeat(64)}`;

// ---------------------------------------------------------------------------------------------------
// The direction receipt and its coverage.

// The scores over several rendered candidates. `dominant` (the default) gives the selected
// candidate a flat 4 and the others a flat 3; `tie` levels every candidate at 4; `loser` keeps the
// selected candidate's mean highest and fails it on TASTE-2 at the wide viewport, where another
// candidate scores higher, which is the second shape of a tie; `short` drops TASTE-12 from one
// candidate so the taste lens is not whole; `uneven` scores one candidate on an extra UX criterion.
// `overrides` forces specific (id, rule[, viewport]) cells to a given score/verdict afterwards, used
// to make a candidate's ## Scores row agree, or disagree, with what ## Candidate limits declares.
function scoreTable(formed, selected, shape = 'dominant', overrides = []) {
  if (formed.length < 1) return [];
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
        rows.push(`| ${BT}${id}${BT} | ${viewport} | ${BT}${rule}${BT} | ${score} | ${verdict} |`);
      }
    }
    if (shape === 'uneven' && id === formed[1]) rows.push(`| ${BT}${id}${BT} | wide | ${BT}UX-9${BT} | 4 | pass |`);
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

function directionMd({
  intent = 'modify', changeLevel = 'reconstruct', ownerCeiling = 'surface-and-nested-layouts',
  classification = 'dominant', policy = 'automatic', selected = 'one-column', candidates = 1,
  surfaceClass = 'catalog', presentationDelta = 'app-owned',
  refClass = 'plan-comparison', selectedFails = false, rejectAll = true, references = changeLevel === 'refine' ? 0 : 1, fallbacks = [],
  printed = null, scores = 'dominant', winner = null, limits = [], scoreOverrides = [], answered = [],
} = {}) {
  const formed = NAMES.slice(0, candidates);
  const shown = printed ?? formed;
  const scoreRows = scores === 'none' ? [] : scoreTable(formed, winner ?? (selected === '—' ? formed[0] : selected), scores, scoreOverrides);
  const printedRows = shown.flatMap((id) => VIEWPORTS.map((viewport) => `| http://127.0.0.1:60000/${id}.html?viewport=${viewport} | the ${viewport} render of the candidate, shown before the decision was written |`));
  const attacks = formed.map((id) => `| content stress | ${BT}${id}${BT} | ${selectedFails && id === selected ? 'fails' : 'holds'} | the widest plan name still fits at 360px |`);
  const others = rejectAll ? formed.filter((id) => id !== selected).map((id) => `| ${BT}${id}${BT} | it loses the offer above the fold on the narrow branch |`) : [];
  const limitRows = limits.map(({ candidate, criterion, says }) => `| ${BT}${candidate}${BT} | ${BT}${criterion}${BT} | ${says} |`);
  const refRows = references ? [`| a public plan picker | ${BT}${refClass}${BT} | https://example.com/plans | the two-column offer-then-decision ordering | it settles nothing about entitlement |`] : [];
  return `# frontend-direction-decision — plan-picker

## Decision

| Field | Value |
| --- | --- |
| Direction id | ${BT}plan-picker${BT} |
| Target | ${BT}/plans${BT} |
| Intent | ${BT}${intent}${BT} |
| Change level | ${BT}${changeLevel}${BT} |
| Owner ceiling | ${BT}${ownerCeiling}${BT} |
| Classification | ${BT}${classification}${BT} |
| Presentation delta | ${BT}${presentationDelta}${BT} |
| Selection policy | ${BT}${policy}${BT} |
| Selected candidate | ${BT}${selected}${BT} |

## Surface class

| Class | Why |
| --- | --- |
${surfaceClass ? `| ${BT}${surfaceClass}${BT} | the surface is a set of comparable offers the reader picks from |` : ''}

## Observed

| Item | Evidence |
| --- | --- |
| what the plans route renders today | ${BT}app/plans/page.tsx:1-64@${HEAD}${BT} |

## UI contract

| Element | Kind | Responsibility |
| --- | --- | --- |
| ${BT}offer${BT} | region | names the offer and its price |
| ${BT}decision${BT} | region | carries the choice and its confirmation |
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

## Findings answered

| Finding | How |
| --- | --- |
${answered.map(([id, how]) => `| ${BT}${id}${BT} | ${how} |`).join('\n')}

## Printed

| Artifact | Why |
| --- | --- |
${printedRows.join('\n')}

## Fallbacks taken

| Code | Action |
| --- | --- |
${fallbacks.map((c) => `| ${BT}${c}${BT} | among the tied top scorers, the candidate introducing the fewest new nodes was selected |`).join('\n')}
`;
}

// ---------------------------------------------------------------------------------------------------
// The resolution receipt, the inventory and the resolved tree.

const TREE = 'response/artifacts/plan-picker.resolved.tsx';
const MAIN = 'body>main';
const SECTION = 'body>main>section';
const ASIDE = 'body>aside';

const resolvedTree = ({ emission = 'on' } = {}) => (emission === 'on'
  ? `export default function PlanPicker() {
  return (
    <main className="gap-6" data-contract="GAP-5">
      <SurfaceCard />
      <aside className="gap-1" data-contract="GAP-1" />
    </main>
  );
}
`
  : `export default function PlanPicker() {
  return (
    <main className="gap-6">
      <SurfaceCard />
      <aside className="gap-1" />
    </main>
  );
}
`);

// The inventory is frozen for the tree beside it: its fingerprint is the hash of that tree.
const inventory = (tree = resolvedTree()) => ({
  treeFingerprint: fingerprintOf(Buffer.from(tree, 'utf8')),
  classNames: ['gap-6', 'gap-1'],
  ruleIds: ['GAP-5', 'GAP-1'],
  gaps: [{ nodePath: ASIDE, property: 'gap', missingPath: 'Common exposes no public path for the compact identity pair' }],
});

const resolutionMd = ({ gaps = 1, removed = 1 } = {}) => `# frontend-presentation-resolution — plan-picker

## Owner map

| Node | Property | Owner | Rule |
| --- | --- | --- | --- |
| ${BT}${MAIN}${BT} | gap | app | ${BT}GAP-5${BT} |
| ${BT}${SECTION}${BT} | padding | grammar | ${BT}PADDING-4${BT} |
| ${BT}${ASIDE}${BT} | gap | app | ${BT}GAP-1${BT} |

## Rules chosen

| Node | Rule | Class | Condition |
| --- | --- | --- | --- |
| ${BT}${MAIN}${BT} | ${BT}GAP-5${BT} | ${BT}gap-6${BT} | region stack inside the page shell |
| ${BT}${ASIDE}${BT} | ${BT}GAP-1${BT} | ${BT}gap-1${BT} | the compact identity pair |

## Removed

| Node | Class | Because |
| --- | --- | --- |
${removed ? `| ${BT}${SECTION}${BT} | ${BT}p-4${BT} | reimplements an owned relationship |` : ''}

## Gaps

| Node | Property | Missing path |
| --- | --- | --- |
${gaps ? `| ${BT}${ASIDE}${BT} | gap | Common exposes no public path for the compact identity pair |` : ''}

## Fallbacks taken

| Code | Action |
| --- | --- |
`;

// A resolution that owes nothing: the direction declared Presentation delta none.
const noneResolutionMd = () => `# frontend-presentation-resolution — plan-picker

## Owner map

| Node | Property | Owner | Rule |
| --- | --- | --- | --- |

## Rules chosen

| Node | Rule | Class | Condition |
| --- | --- | --- | --- |

## Removed

| Node | Class | Because |
| --- | --- | --- |

## Gaps

| Node | Property | Missing path |
| --- | --- | --- |

## Fallbacks taken

| Code | Action |
| --- | --- |
`;
const noneInventory = (tree = resolvedTree({ emission: 'off' })) => ({ treeFingerprint: fingerprintOf(Buffer.from(tree, 'utf8')), classNames: [], ruleIds: [], gaps: [] });

// ---------------------------------------------------------------------------------------------------
// The application receipt, the change record and the write plan.

const PAGE = 'app/plans/page.tsx';
const CANVAS = 'app/plans/canvas.tsx';
const LEGEND = 'app/plans/legend.tsx';

const cleanSweep = () => ({
  command: 'node scripts/sweep-presentation.mjs . --write-set response/data/write-set.txt --json',
  exitCode: 0,
  findings: [],
  output: 'sweep-presentation: clean, 3 file(s)',
});

const plan = ({ mode = 'apply', commit = COMMIT, sweep = cleanSweep(), classes = ['gap-6'] } = {}) => ({
  mode,
  base: HEAD,
  branch: `session/${SESSION}`,
  commit,
  sweep,
  files: [
    { path: PAGE, change: 'modified', before: fp('b'), after: fp('c'), classes },
    { path: CANVAS, change: 'created', before: null, after: fp('d'), classes: [] },
    { path: LEGEND, change: 'unchanged', before: fp('e'), after: fp('e'), classes: [] },
  ],
});

const dryPlan = () => ({
  mode: 'dry',
  base: HEAD,
  branch: `session/${SESSION}`,
  commit: null,
  sweep: cleanSweep(),
  files: [
    { path: PAGE, change: 'modified', before: fp('b'), after: null, classes: ['gap-6'] },
    { path: CANVAS, change: 'created', before: null, after: null, classes: [] },
  ],
});

const applicationMd = ({ mode = 'apply', commit = COMMIT, files, fallbacks = [] } = {}) => {
  const rows = (files ?? plan().files).map(({ path: p, change, classes }) => `| ${BT}${p}${BT} | ${change} | ${classes.length ? `${BT}${classes[0]}${BT}` : '—'} | ${classes.length ? `${BT}GAP-5${BT}` : '—'} | ${change === 'created' ? 'an application-owned leaf carrying its contract' : 'the resolved value for this node'} |`);
  return `# frontend-source-application — plan-picker

## Binding

| Field | Value |
| --- | --- |
| Target | ${BT}plan-picker${BT} |
| Mode | ${BT}${mode}${BT} |
| Branch | ${BT}session/${SESSION}${BT} |
| Base | ${BT}${HEAD}${BT} |
| Commit | ${commit ? `${BT}${commit}${BT}` : '—'} |

## Projection

| Path | Change | Classes | Claims | Why |
| --- | --- | --- | --- | --- |
${rows.join('\n')}

## Rejections

| Path | Value | Because |
| --- | --- | --- |

## Fallbacks taken

| Code | Action |
| --- | --- |
${fallbacks.map((c) => `| ${BT}${c}${BT} | among the tied top scorers, the candidate introducing the fewest new nodes was selected |`).join(String.fromCharCode(10))}
`;
};

// The marks a source-writing branch reads off the checkout: HEAD stood on the base at dispatch and on
// the branch own commit at the end, one entry apart, with the stash reflog untouched.
const PREFLIGHT = 'passed at 2026-09-05T09:12:00Z';
const REFLOG_BEFORE = `HEAD 7 ${HEAD}; stash 0`;
const REFLOG_AFTER = `HEAD 8 ${COMMIT}; stash 0`;

const changesMd = ({ files, operator = 'interface.generate', preflight = PREFLIGHT, reflogBefore = REFLOG_BEFORE, reflogAfter = REFLOG_AFTER } = {}) => {
  const rows = (files ?? plan().files).map(({ path: p, change, classes }) => `| ${BT}${p}${BT} | ${change} | ${change === 'created' ? 'the application-owned leaf the direction marked' : 'the resolved value for this node'} | ${classes.length ? `${BT}GAP-5${BT}` : '—'} |`);
  return `# changes — ${operator} step-2/parallel-1

The plans page and its application-owned canvas carry the resolved spacing on the session branch.

## Binding

| Field | Value |
| --- | --- |
| Operator | ${BT}${operator}${BT} |
| Step | ${BT}step-2/parallel-1${BT} |
| Checkout | ${BT}@workspaces/fe${BT} at ${BT}${HEAD}${BT} → ${BT}${COMMIT}${BT} on ${BT}session/${SESSION}${BT} |
| Predecessor | ${BT}step-1/parallel-1/response/response.md${BT} |
| Preflight | ${preflight} |
| Reflog before | ${reflogBefore} |
| Reflog after | ${reflogAfter} |

## Files

| Path | Change | Why | Claims |
| --- | --- | --- | --- |
${rows.join('\n')}

## What the next step must know

- Gates to run: the lint and type gates the checkout pins for these paths.
- Surfaces to observe: the /plans route at both branches.
- Not changed on purpose: the legend, because the resolution decided nothing about it.
`;
};

// ---------------------------------------------------------------------------------------------------
// The branch.

// The findings ledger's open lines for the plans surface, materialized beside the last audit of it:
// one finding on this target, one on another surface the generator owes nothing to.
const FINDINGS_IN = 'step-1/parallel-2/response/data/findings.json';
const OPEN = 'f0a1b2c3d4e5f';
const OTHER = 'f1a1b2c3d4e5f';
const findingsDoc = ({ target = '/plans', extraLines = [] } = {}) => ({
  schemaVersion: 9,
  family: 'core',
  surfaces: [target, 'checkout'],
  lines: [
    { id: OPEN.slice(0, 13), at: '2026-09-04T10:00:00.000Z', session: 's-prior', branch: '4/1', operator: 'interface.audit', family: 'core', surface: target, unit: 'wide-light-loaded', rule: 'TASTE-2', code: 'DIRECTION', statement: 'TASTE-2: a tinted band whose only occupant is an ornament', severity: 'blocking', fixed: null },
    { id: OTHER.slice(0, 13), at: '2026-09-04T10:00:00.000Z', session: 's-prior', branch: '4/1', operator: 'interface.audit', family: 'core', surface: 'checkout', unit: 'wide-light-loaded', rule: 'GAP-5', code: 'RESOLVE', statement: 'body>main: 1rem', severity: 'blocking', fixed: null },
    ...extraLines,
  ],
});

const requestJson = ({ extra = {}, inputs = {} } = {}) => ({
  schemaVersion: 9,
  operatorId: 'interface.generate',
  step: 2,
  parallel: 1,
  sessionId: SESSION,
  ...(extra.approval ? { decisionId: 'layout-direction', selectedOption: extra.approval } : {}),
  contexts: [{ alias: '@workspaces/fe', head: HEAD }, { alias: '@grammar/core', head: null }, { alias: '@knowledge/ui/composition', head: null }, { alias: '@knowledge/ui/presentation', head: null }, { alias: '@knowledge/ui/proof', head: null }, { alias: '@knowledge/grammars/starci', head: null }],
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
    maxRounds: 2,
    contractEmission: 'on',
    mode: 'apply',
    resume: null,
    ...extra,
  },
  inputs: { 'business-promise-authority': 'step-1/parallel-1/response/response.md', ...inputs },
  resume: null,
});

const DIRECTION_FIELDS = { 'frontend-direction-decision': 'response/direction.md', 'ui-coverage': 'response/data/coverage.json' };
const RESOLUTION_FIELDS = { 'frontend-presentation-resolution': 'response/resolution.md', inventory: 'response/data/inventory.json', 'resolved-tree': TREE };
const APPLICATION_FIELDS = { 'frontend-source-application': 'response/response.md', changes: 'response/changes.md', writes: 'response/data/writes.json' };
const allFields = (candidates = ['response/artifacts/one-column.html']) => ({ ...DIRECTION_FIELDS, ...(candidates.length ? { candidates } : {}), ...RESOLUTION_FIELDS, ...APPLICATION_FIELDS });

const responseJson = ({ status = 'done', stop, fields, fallbacks = [], commits = [COMMIT], next = ['interface.audit'], reason, interaction } = {}) => ({
  schemaVersion: 9,
  operatorId: 'interface.generate',
  step: 2,
  parallel: 1,
  status,
  ...(stop ? { stop } : {}),
  ...(reason ? { reason } : {}),
  ...(interaction ? { interaction } : {}),
  fallbacks,
  fields: fields ?? allFields(),
  commits: status === 'done' ? commits : [],
  next: status === 'done' ? next : [],
});

function writeBranch(files) {
  const session = mkdtempSync(path.join(tmpdir(), 'interface-generate-session-'));
  const branch = path.join(session, 'step-2', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  mkdirSync(path.join(session, 'step-1', 'parallel-1', 'response'), { recursive: true });
  writeFileSync(path.join(session, 'step-1', 'parallel-1', 'response', 'response.md'), '# business-promise-authority — plans\n');
  const approval = files['request/request.json']?.requirements?.approval;
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: SESSION, project: 'starci-academy', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['1/1'], ['2/1']], steps: { '1/1': 'business.decide', '2/1': 'interface.generate' }, current: '2/1', status: 'running', ...(approval ? { choices: { 'layout-direction': { selected: approval, selectedBy: 'user', sourceRef: 'fixture:user-selected-direction' } } } : {}) }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    const target = name.startsWith('../../') ? path.join(session, name.slice(6)) : path.join(branch, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  if (files['response/response.json']?.status === 'done') {
    writeUiKnowledgeFixture(path.resolve('.'), branch, ['@knowledge/ui/composition', '@knowledge/ui/presentation', '@knowledge/ui/proof', '@knowledge/grammars/<family>'], 'response/artifacts/one-column.html');
  }
  return { branch, session };
}

// A reconstruct renders every candidate it forms, so the baseline carries its one page, resolves the
// three-node tree and writes it on the session branch in one commit.
const baseline = () => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/direction.md': directionMd(),
  'response/data/coverage.json': coverage(),
  'response/artifacts/one-column.html': '<!doctype html><title>one-column</title>',
  'response/resolution.md': resolutionMd(),
  'response/data/inventory.json': inventory(),
  [TREE]: resolvedTree(),
  'response/response.md': applicationMd(),
  'response/changes.md': changesMd(),
  'response/data/writes.json': plan(),
});

// A refine is rendered and scored like every other candidate.
const refine = (over = {}) => ({
  ...baseline(),
  'request/request.json': requestJson({ extra: { changeLevel: 'refine' } }),
  'response/direction.md': directionMd({ changeLevel: 'refine', classification: 'locked-refine' }),
  ...over,
});

// Three rendered candidates, scored. Under the default the scores make one-column dominant and the
// operator decides under either policy; `tie` levels them, so automatic takes the fallback and
// approval-required needs the person's approval.
const threeCandidates = ({ policy = 'automatic', approval = null, tie = false, extraResponse = {}, md = {} } = {}) => ({
  ...baseline(),
  'request/request.json': requestJson({ extra: { candidates: 3, selectionPolicy: policy, approval } }),
  'response/response.json': responseJson({
    fallbacks: tie && policy === 'automatic' ? ['DIRECTION_CHOICE_REQUIRED'] : [],
    fields: allFields(NAMES.map((n) => `response/artifacts/${n}.html`)),
    ...extraResponse,
  }),
  'response/direction.md': directionMd({ policy, candidates: 3, scores: tie ? 'tie' : 'dominant', fallbacks: tie && policy === 'automatic' ? ['DIRECTION_CHOICE_REQUIRED'] : [], ...md }),
  'response/response.md': applicationMd({ fallbacks: tie && policy === 'automatic' ? ['DIRECTION_CHOICE_REQUIRED'] : [] }),
  ...Object.fromEntries(NAMES.map((n) => [`response/artifacts/${n}.html`, `<!doctype html><title>${n}</title>`])),
});

// A copy-only change: the direction declares Presentation delta none, the resolution resolves
// nothing, the tree carries no claim, and the write carries no class.
const noneBranch = () => ({
  ...baseline(),
  'response/direction.md': directionMd({ presentationDelta: 'none' }),
  'response/resolution.md': noneResolutionMd(),
  'response/data/inventory.json': noneInventory(),
  [TREE]: resolvedTree({ emission: 'off' }),
  'response/data/writes.json': plan({ classes: [] }),
  'response/response.md': applicationMd({ files: plan({ classes: [] }).files }),
  'response/changes.md': changesMd({ files: plan({ classes: [] }).files }),
});

// A dry run: the same direction and resolution, with a plan and nothing committed.
const dryRun = () => ({
  ...baseline(),
  'request/request.json': requestJson({ extra: { mode: 'dry' } }),
  'response/response.json': responseJson({ commits: [] }),
  'response/response.md': applicationMd({ mode: 'dry', commit: null, files: dryPlan().files }),
  'response/changes.md': changesMd({ files: dryPlan().files, reflogAfter: REFLOG_BEFORE }),
  'response/data/writes.json': dryPlan(),
});

async function expectValid(files, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateGenerateStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label) {
  const { branch, session } = writeBranch(files);
  const { errors } = await validateGenerateStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}
const withCoverage = (change) => { const c = coverage(); change(c); return { ...baseline(), 'response/data/coverage.json': c }; };
const withInventory = (change) => { const m = inventory(); change(m); return { ...baseline(), 'response/data/inventory.json': m }; };
const withPlan = (change) => { const p = plan(); change(p); return { ...baseline(), 'response/data/writes.json': p }; };

// ---------------------------------------------------------------------------------------------------
// Lawful branches.

await expectValid(baseline(), 'defaults (modify, reconstruct, one candidate rendered, automatic), the tree resolved and written in one commit');
await expectValid(refine(), 'a refine under the defaults renders no page');
await expectValid({ ...baseline(), 'response/direction.md': directionMd({ surfaceClass: 'console' }), 'response/data/coverage.json': { ...coverage(), surfaceClass: 'console' } }, 'another class of the published vocabulary, declared in the receipt and carried by the coverage');
await expectValid(threeCandidates(), 'three candidates, the scores make one dominant and the operator decides');
await expectValid(threeCandidates({ tie: true }), 'three candidates level on the scores, the tie broken by the fallback');
await expectError(threeCandidates({ policy: 'approval-required' }), 'the user selects the tier', 'a dominant recommendation cannot replace a required user choice');
await expectValid(threeCandidates({ policy: 'approval-required', approval: 'one-column', tie: true }), 'three candidates level on the scores, the tie approved by the person');
await expectValid(noneBranch(), 'a copy-only change under Presentation delta none resolves nothing and writes no class');
await expectValid({ ...baseline(), 'request/request.json': requestJson({ extra: { contractEmission: 'off' } }), [TREE]: resolvedTree({ emission: 'off' }), 'response/data/inventory.json': inventory(resolvedTree({ emission: 'off' })) }, 'contract emission off leaves the tree bare');
await expectValid({ ...baseline(), [TREE]: resolvedTree().replace(' data-contract="GAP-1"', ''), 'response/data/inventory.json': inventory(resolvedTree().replace(' data-contract="GAP-1"', '')) }, 'a rule whose only node is recorded under Gaps claims no attribute');
await expectValid(dryRun(), 'a dry run that commits nothing');

// Blocked at each of the three halves, with only what was written before the stop.
await expectValid({ 'request/request.json': requestJson(), 'response/response.json': responseJson({ status: 'blocked', stop: 'REFERENCE_MISSING', fields: {} }) }, 'a reconstruct that could name no standard by class stops with REFERENCE_MISSING');
await expectValid({ 'request/request.json': requestJson(), 'response/response.json': responseJson({ status: 'blocked', stop: 'RULE_MISSING', fields: { ...DIRECTION_FIELDS, candidates: ['response/artifacts/one-column.html'] } }), 'response/direction.md': directionMd(), 'response/data/coverage.json': coverage(), 'response/artifacts/one-column.html': '<!doctype html>' }, 'blocked on RULE_MISSING after the decision and before anything was resolved or written');
await expectValid({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'WRITE_REJECTED', fields: { ...DIRECTION_FIELDS, candidates: ['response/artifacts/one-column.html'], ...RESOLUTION_FIELDS } }), 'response/response.md': null, 'response/changes.md': null, 'response/data/writes.json': null }, 'blocked on WRITE_REJECTED with the tree resolved and nothing written');

// Material choices reach the person as typed options backed by rendered and scored candidates.
// A dominant recommendation does not replace a user answer.
const CHOICE_REASON = 'http://127.0.0.1:60000/ — which of the three compositions do you take?';
const printedChoice = ({ candidates = 3, printed = NAMES.slice(0, candidates), reason = CHOICE_REASON, receipt = true, scores = 'tie' } = {}) => ({
  'request/request.json': requestJson({ extra: { candidates, selectionPolicy: 'approval-required' } }),
  'response/response.json': responseJson({
    status: 'blocked',
    stop: 'DIRECTION_CHOICE_REQUIRED',
    reason,
    interaction: { kind: 'tier-choice', decisionId: 'layout-direction', options: NAMES.slice(0, candidates).map((id) => ({ id, label: id, tradeoff: `Distinct experience of ${id}` })) },
    fields: { ...(receipt ? DIRECTION_FIELDS : {}), candidates: NAMES.slice(0, candidates).map((n) => `response/artifacts/${n}.html`) },
  }),
  ...(receipt ? { 'response/direction.md': directionMd({ policy: 'approval-required', candidates, selected: '—', rejectAll: false, printed, scores }), 'response/data/coverage.json': coverage() } : {}),
  ...Object.fromEntries(NAMES.slice(0, candidates).map((n) => [`response/artifacts/${n}.html`, `<!doctype html><title>${n}</title>`])),
});
await expectValid(printedChoice(), 'DIRECTION_CHOICE_REQUIRED under approval-required over a proven tie: three candidates printed at both viewports, one question for the person');
await expectValid(printedChoice({ scores: 'loser' }), 'DIRECTION_CHOICE_REQUIRED over the other tie: the top mean loses a failed criterion to another candidate');
await expectValid(printedChoice({ candidates: 2 }), 'two rendered directions are a complete tier choice');
await expectValid(printedChoice({ scores: 'dominant' }), 'a recommendation does not replace the user tier choice');

// ---------------------------------------------------------------------------------------------------
// The direction law.

await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { intent: 'create' } }) }, 'intent create requires changeLevel new', 'create without new');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { candidates: 4 } }) }, 'candidates must be 1, 2 or 3', 'four candidates');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { approval: 'one-column' } }) }, 'approval is bound under automatic policy', 'approval under automatic');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { mystery: 1 } }) }, 'requirements.mystery is not a field', 'undeclared requirement');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { changeLevel: '' } }) }, 'required field changeLevel has no value', 'missing change level');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { candidates: 2 } }), 'response/response.json': responseJson({ fields: allFields([]) }) }, 'more than one candidate was formed but none was rendered', 'comparison without pages');
await expectValid(refine(), 'a single refine is rendered, printed and scored before source write');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fields: allFields([]) }) }, 'a reconstruct direction renders every candidate it forms', 'a reconstruct whose candidate nobody can see');
await expectError({ ...threeCandidates(), 'response/response.json': responseJson({ fields: allFields(['response/artifacts/one-column.html']) }) }, '3 formed and 1 rendered', 'a reconstruct that rendered only the candidate it liked');
await expectError({ ...baseline(), 'response/direction.md': directionMd({ changeLevel: 'refine' }) }, 'Change level refine differs from the request', 'receipt and request disagree on the change level');
await expectError(refine({ 'response/direction.md': directionMd({ changeLevel: 'refine' }) }), 'a refine is classified locked-refine', 'refine classified dominant');
await expectError(refine({ 'response/direction.md': directionMd({ changeLevel: 'refine', classification: 'locked-refine', references: 1 }) }), 'a refine works from the family idioms alone', 'refine that researched');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { references: ['https://example.com/plans'] } }), 'response/direction.md': directionMd({ references: 0 }) }, 'the person supplied references and none of them is recorded', 'supplied reference dropped');
await expectError({ ...baseline(), 'response/direction.md': directionMd({ references: 0 }) }, 'names at least one reference standard by class', 'a reconstruct that named no standard');
await expectError({ ...baseline(), 'response/direction.md': directionMd({ refClass: '' }) }, 'Class', 'a standard with no class');
await expectError({ ...baseline(), 'response/direction.md': directionMd({ selectedFails: true }) }, 'fails an attack, so the direction is not decided', 'selected candidate fails an attack');
await expectError({ ...threeCandidates(), 'response/direction.md': directionMd({ candidates: 3, rejectAll: false }) }, 'is not rejected by name', 'unselected candidate not rejected');
await expectError({ ...baseline(), 'response/direction.md': directionMd({ candidates: 2 }).replace(`| ${BT}split-view${BT} | it loses`, `| ${BT}absent${BT} | it loses`) }, 'Falsification covers 2 candidates, the request asked for 1', 'more candidates than asked');
await expectError({ ...threeCandidates({ policy: 'approval-required', approval: 'split-view', tie: true }) }, 'but approval names split-view', 'approval names another candidate');
await expectError({ ...threeCandidates({ policy: 'approval-required', tie: true }) }, 'approval-required with no approval cannot end done', 'approval-required decided a tie without an approval');
// Several rendered candidates are ranked, not offered: the scores are present for every one, whole
// and comparable; the dominant candidate is the one selected; a tie is recorded as the fallback it
// was, and a fallback over a dominant candidate is a choice that never existed.
await expectError({ ...threeCandidates(), 'response/direction.md': directionMd({ candidates: 3, scores: 'none' }) }, '## Scores carries no row', 'three rendered candidates decided with no scores');
await expectError({ ...threeCandidates(), 'response/direction.md': directionMd({ candidates: 3, selected: 'split-view', winner: 'one-column' }) }, 'the scores make one-column dominant', 'the receipt selects a candidate the scores rank below another');
await expectError({ ...threeCandidates({ tie: true }), 'response/direction.md': directionMd({ candidates: 3, scores: 'dominant', fallbacks: ['DIRECTION_CHOICE_REQUIRED'] }) }, 'no choice was required', 'a fallback recorded over a dominant candidate');
await expectError({ ...threeCandidates({ tie: true }), 'response/response.md': applicationMd() }, 'not recorded under ## Fallbacks taken', 'a fallback taken and left out of the primary receipt');
await expectError({ ...threeCandidates(), 'response/direction.md': directionMd({ candidates: 3, scores: 'tie' }) }, 'no candidate dominates', 'a tie decided under automatic with no fallback recorded');
await expectError({ ...threeCandidates(), 'response/direction.md': directionMd({ candidates: 3, scores: 'short' }) }, 'the taste lens is scored whole', 'a candidate scored without the whole taste lens');
await expectError({ ...threeCandidates(), 'response/direction.md': directionMd({ candidates: 3, scores: 'uneven' }) }, 'different criterion set', 'candidates scored on different criterion sets');
// A score is a claim about the candidate it is scored for: a candidate's own description can
// declare, under ## Candidate limits, that it does not satisfy a criterion, and ## Scores must then
// score that pairing at the failing end wherever it carries it, and carry it at all.
const SPLIT_VIEW_LIMIT = [{ candidate: 'split-view', criterion: 'TASTE-10', says: 'the empty state carries no action of its own' }];
await expectValid({ ...threeCandidates(), 'response/direction.md': directionMd({ candidates: 3, limits: SPLIT_VIEW_LIMIT, scoreOverrides: [{ id: 'split-view', rule: 'TASTE-10', score: 2, verdict: 'fail' }] }) }, 'a candidate declares it does not satisfy a criterion and ## Scores fails it at every viewport it carries');
await expectError({ ...threeCandidates(), 'response/direction.md': directionMd({ candidates: 3, limits: SPLIT_VIEW_LIMIT, scoreOverrides: [{ id: 'split-view', rule: 'TASTE-10', viewport: 'wide', score: 2, verdict: 'fail' }] }) }, "a score that contradicts the candidate's own description is refused", 'the same candidate scored at the passing end on the narrow viewport');
await expectError({ ...threeCandidates(), 'response/direction.md': directionMd({ candidates: 3, limits: [{ candidate: 'split-view', criterion: 'UX-9', says: 'the destructive action is never confirmed inline' }] }) }, 'and ## Scores carries no row for that pairing', 'a declared non-satisfaction with no corresponding row in ## Scores');
await expectError(withCoverage((c) => { c.regions = c.regions.slice(0, 1); }), 'COVERAGE-1: region is not covered: decision', 'region uncovered');
await expectError(withCoverage((c) => { c.actions = []; }), 'COVERAGE-1: actions must enumerate every declared action', 'actions uncovered');
await expectError(withCoverage((c) => { c.states[1].carrier = 'the offer region'; }), 'COVERAGE-1: two meanings share one carrier', 'two meanings on one carrier');
await expectError(withCoverage((c) => { c.actions[0].pendingPaths[0].settlement = ''; }), 'pending path without a settlement', 'unsettled pending path');
await expectError(withCoverage((c) => { c.directionId = 'other-picker'; }), 'differs from the receipt', 'coverage names another direction');
await expectError({ ...baseline(), 'response/direction.md': directionMd({ printed: [] }) }, 'was rendered and never printed', 'a candidate rendered and never put in front of the person');
await expectError({ ...threeCandidates(), 'response/direction.md': directionMd({ candidates: 3, printed: ['one-column'] }) }, 'candidate split-view was rendered and never printed', 'only the favourite candidate printed');
await expectError({ ...baseline(), 'response/direction.md': directionMd({ surfaceClass: '' }) }, 'Surface class', 'a decided direction that declares no surface class');
await expectError({ ...baseline(), 'response/direction.md': directionMd({ surfaceClass: 'dashboard' }), 'response/data/coverage.json': { ...coverage(), surfaceClass: 'dashboard' } }, 'outside the vocabulary COVERAGE-1 Case 7 publishes', 'a class name nobody publishes');
await expectError(withCoverage((c) => { delete c.surfaceClass; }), 'surfaceClass', 'coverage with no declared class');
await expectError(withCoverage((c) => { c.surfaceClass = 'console'; }), "surfaceClass console differs from the receipt's catalog", 'receipt and coverage declare two classes');
await expectError({ ...baseline(), 'response/data/coverage.json': null, 'response/response.json': responseJson({ fields: (() => { const f = allFields(); delete f['ui-coverage']; return f; })() }) }, 'required output ui-coverage is not in fields', 'missing required coverage');
await expectError({ ...baseline(), 'response/direction.md': directionMd().replace('## Observed', '## Observations') }, 'missing section ^## Observed$', 'decision receipt section renamed');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'DIRECTION_CHOICE_REQUIRED' }) }, 'has disposition fallback under these requirements', 'terminating on the choice under automatic');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MADE_UP_CODE' }) }, 'not a registered code', 'unknown stop code');
await expectError({ ...baseline(), 'response/direction.md': directionMd({ presentationDelta: 'cosmetic' }) }, 'is neither app-owned nor none', 'an unknown delta value');

// The findings ledger, answered: every open line for this target is named under ## Findings answered
// with what the direction does about it; a line for another surface is owed nothing; a row naming
// a finding the input does not carry is refused; and a generator that ignores a known finding is refused.
const OPEN_ID = OPEN.slice(0, 13);
const OTHER_ID = OTHER.slice(0, 13);
const withFindings = ({ answered = [[OPEN_ID, 'the band is removed and the region carries the offer copy']], doc = findingsDoc(), unit } = {}) => ({
  ...baseline(),
  'request/request.json': { ...requestJson({ inputs: { findings: FINDINGS_IN } }), ...(unit ? { unit } : {}) },
  [`../../${FINDINGS_IN}`]: doc,
  'response/direction.md': directionMd({ answered }),
});
await expectValid(withFindings(), 'the one open finding for this target is answered; the other surface\'s is owed nothing');
await expectError(withFindings({ answered: [] }), `finding ${OPEN_ID}`, 'a generator that ignores a known finding');
await expectError(withFindings({ answered: [[OPEN_ID, 'answered'], ['f9999999999ff', 'a finding nobody recorded']] }), 'which the findings input does not carry', 'a row naming a finding the ledger never held');
await expectValid(withFindings({ answered: [], doc: findingsDoc({ target: '/other' }) }), 'no open finding for this target: the table stays empty');
await expectValid(withFindings({ answered: [[OTHER_ID, 'the gap is resolved again']], doc: findingsDoc({ target: '/other' }), unit: 'checkout' }), 'a unit branch answers the finding recorded on its unit id');
await expectError(withFindings({ answered: [], doc: findingsDoc({ target: '/other' }), unit: 'checkout' }), `finding ${OTHER_ID}`, 'a unit branch that ignores the finding on its unit');
await expectError(withFindings({ doc: { schemaVersion: 9, family: 'core', surfaces: ['/plans'], lines: [{ id: 'nope' }] } }), 'lines[0]', 'a findings input outside its kind');

// The hand-off to the person.
await expectError(printedChoice({ printed: [], reason: 'Accept the composition and record the density band as seeded-data-limited, or handle the density band and three family gaps first?' }), 'lists no rendered candidate', 'a choice handed over as two prose options');
await expectError(printedChoice({ candidates: 2, printed: ['one-column'] }), 'option split-view is offered and never printed', 'a two-option choice printed with one candidate');
await expectError(printedChoice({ receipt: false }), 'with no receipt', 'a choice stop that carries no receipt and so printed nothing');
await expectError(printedChoice({ reason: 'http://127.0.0.1:60000/ — one-column keeps the offer above the fold and split-view reads denser; which do you prefer, or should I refine first?' }), 'is not one question', 'a message that narrates the options instead of asking one question');
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

// ---------------------------------------------------------------------------------------------------
// The resolution law.

await expectError({ ...baseline(), 'response/direction.md': directionMd({ presentationDelta: 'none' }) }, 'declares Presentation delta none and the resolution still resolves', 'values resolved under a none delta');
await expectError({ ...noneBranch(), 'response/resolution.md': resolutionMd(), [TREE]: resolvedTree(), 'response/data/inventory.json': noneInventory(resolvedTree()) }, 'declares Presentation delta none', 'receipt rows under a none delta');
await expectError({ ...noneBranch(), 'response/direction.md': directionMd() }, 'cannot both be empty', 'nothing resolved under the default app-owned delta');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { maxRounds: 0 } }) }, 'maxRounds must be a positive whole number', 'no rounds allowed');
await expectError(withInventory((m) => { m.ruleIds.push('GAP-99'); }), 'is outside the published presentation inventory', 'unpublished rule');
await expectError(withInventory((m) => { m.classNames.push('gap-11'); }), 'is in the inventory and not in the resolved tree', 'class that never reached the tree');
await expectError(withInventory((m) => { m.treeFingerprint = 'nope'; }), 'treeFingerprint', 'inventory schema');
await expectError({ ...baseline(), [TREE]: resolvedTree().replace(' data-contract="GAP-5"', ''), 'response/data/inventory.json': inventory(resolvedTree().replace(' data-contract="GAP-5"', '')) }, 'no node claims it under data-contract', 'applied rule with no claim');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { contractEmission: 'off' } }) }, 'contract emission is off and the resolved tree carries a data-contract', 'claims written under emission off');
const ordinalTree = resolvedTree().replace('gap-6', 'gap-5');
await expectError({ ...baseline(), 'response/resolution.md': resolutionMd().replace(`| ${BT}body>main${BT} | ${BT}GAP-5${BT} | ${BT}gap-6${BT} |`, `| ${BT}body>main${BT} | ${BT}GAP-5${BT} | ${BT}gap-5${BT} |`), 'response/data/inventory.json': { ...inventory(ordinalTree), classNames: ['gap-5', 'gap-1'] }, [TREE]: ordinalTree, 'response/data/writes.json': plan({ classes: ['gap-5'] }) }, 'renders GAP-5 as gap-5, expected step 6', 'ordinal written as the step');
await expectError({ ...baseline(), 'response/resolution.md': resolutionMd().replace(`| ${BT}${SECTION}${BT} | padding | grammar | ${BT}PADDING-4${BT} |`, `| ${BT}${SECTION}${BT} | padding | app | ${BT}PADDING-4${BT} |`) }, 'owns PADDING-4 and chooses no class for it', 'application claims an owned property and writes nothing');
await expectError({ ...baseline(), 'response/resolution.md': resolutionMd().replace(`| ${BT}${ASIDE}${BT} | ${BT}GAP-1${BT} | ${BT}gap-1${BT} | the compact identity pair |`, `| ${BT}${SECTION}${BT} | ${BT}PADDING-4${BT} | ${BT}p-4${BT} | the card inset |`) }, 'chooses a class for PADDING-4, which Grammar already owns', 'application reimplements a Grammar relationship');
await expectError({ ...baseline(), 'response/resolution.md': resolutionMd().replace(`| ${BT}${MAIN}${BT} | gap | app | ${BT}GAP-5${BT} |`, `| ${BT}${MAIN}${BT} | gap | app | ${BT}GAP-5${BT} |\n| ${BT}${MAIN}${BT} | gap | app | ${BT}GAP-4${BT} |`) }, 'decides gap more than once in the owner map', 'one property decided twice');
await expectError({ ...baseline(), 'response/resolution.md': resolutionMd({ gaps: 0 }) }, 'the Gaps table and inventory.gaps differ', 'gap recorded in data and not for the reader');
await expectError(withInventory((m) => { m.gaps = []; }), 'the Gaps table and inventory.gaps differ', 'gap recorded for the reader and not in data');
await expectError({ ...baseline(), 'response/resolution.md': resolutionMd().replace(`| ${BT}p-4${BT} | reimplements an owned relationship |`, `| ${BT}gap-6${BT} | reimplements an owned relationship |`) }, 'and the inventory still carries it', 'class removed and still inventoried');
await expectError({ ...baseline(), 'response/resolution.md': resolutionMd().replace('## Removed', '## Deleted') }, 'missing section ^## Removed$', 'resolution receipt section renamed');
await expectError({ ...baseline(), 'response/data/inventory.json': null, 'response/response.json': responseJson({ fields: (() => { const f = allFields(); delete f.inventory; return f; })() }) }, 'required output inventory is not in fields', 'missing required inventory');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fallbacks: ['RULE_MISSING'] }) }, 'has disposition terminate under these requirements', 'a terminate code taken as a fallback');

// ---------------------------------------------------------------------------------------------------
// The application law.

await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { mode: 'dry' } }) }, "mode apply differs from the request's dry", 'mode re-decided in the plan');
await expectError(withPlan((p) => { p.files[0].classes = ['gap-8']; }), 'writes class gap-8, which the resolution never published', 'class the resolution never published');
await expectError(withPlan((p) => { p.branch = 'mtp'; }), 'only session/<sessionId> may be committed to', 'write on the person\'s branch');
await expectError(withPlan((p) => { p.branch = 'session/other'; }), 'is not the session branch of', 'write on another session branch');
await expectError(withPlan((p) => { p.commit = null; }), 'commits the declared write set exactly once', 'applied run without a commit');
await expectError({ ...baseline(), 'response/response.json': responseJson({ commits: [COMMIT, HEAD] }) }, 'records exactly one commit, found 2', 'two commits for one write set');
await expectError({ ...baseline(), 'response/response.json': responseJson({ commits: [HEAD] }) }, 'is not the commit', 'response and plan disagree on the commit');
await expectError({ ...dryRun(), 'response/response.json': responseJson({ commits: [COMMIT] }) }, 'a dry run records no commit', 'dry run that committed');
await expectError({ ...dryRun(), 'response/data/writes.json': { ...dryPlan(), commit: COMMIT } }, 'a dry run commits nothing, so commit must be null', 'dry plan carrying a commit');
await expectError(withPlan((p) => { p.files = p.files.map((f) => ({ ...f, change: 'unchanged', before: f.after ?? fp('e'), after: f.after ?? fp('e'), classes: [] })); }), 'moves at least one declared path', 'nothing moved');
await expectError(withPlan((p) => { p.files[0].after = p.files[0].before; }), 'reports a modification with an unchanged hash', 'modification that did not move');
await expectError(withPlan((p) => { p.files[1].before = fp('f'); }), 'was created but reports a prior hash', 'creation with a prior hash');
await expectError(withPlan((p) => { p.files[2].classes = ['gap-6']; }), 'is reported unchanged while carrying classes', 'unchanged file carrying classes');
await expectError(withPlan((p) => { p.files.push({ ...p.files[0] }); }), 'appears twice in the plan', 'one path planned twice');
await expectError({ ...baseline(), 'response/response.md': applicationMd({ commit: HEAD }) }, 'Commit', 'receipt and plan disagree on the commit');
await expectError({ ...baseline(), 'response/changes.md': changesMd().replace(`| ${BT}${LEGEND}${BT} | unchanged | the resolved value for this node | — |\n`, '') }, 'Files lists 2 paths, the plan carries 3', 'changes.md hides a planned path');
await expectError({ ...baseline(), 'response/changes.md': changesMd().replace('| modified |', '| deleted |') }, 'is deleted here and modified in the plan', 'changes.md contradicts the plan');
await expectError({ ...baseline(), 'response/changes.md': changesMd().replace(` on ${BT}session/${SESSION}${BT}`, '') }, 'does not name the session branch', 'changes.md hides the session branch');
await expectError({ ...baseline(), 'response/changes.md': changesMd({ operator: 'backend.generate' }) }, 'names another operator', 'changes.md signed by another operator');
await expectError({ ...baseline(), 'response/data/inventory.json': { ...inventory(), treeFingerprint: fp('9') } }, 'RESOLUTION_STALE', 'an inventory frozen for another tree than the one beside it');
await expectError({ ...baseline(), 'response/response.md': applicationMd().replace('## Rejections', '## Rejected') }, 'missing section ^## Rejections$', 'application receipt section renamed');
await expectError({ ...baseline(), 'response/data/writes.json': null, 'response/response.json': responseJson({ fields: (() => { const f = allFields(); delete f.writes; return f; })() }) }, 'required output writes is not in fields', 'missing required write plan');

// The presentation sweep: it ran, it ran the right command, it agrees with its own exit code, it read
// only declared paths, and a finding blocks the branch instead of riding along with a done receipt.
await expectError(withPlan((p) => { delete p.sweep; }), 'records the presentation sweep over the declared paths', 'applied write set with no sweep');
await expectError(withPlan((p) => { p.sweep.command = 'node scripts/lint.mjs'; }), 'is not scripts/sweep-presentation.mjs', 'a different command wearing the sweep\'s name');
await expectError(withPlan((p) => { p.sweep.findings = [{ code: 'APP_REIMPLEMENTATION', file: PAGE, line: 12, object: 'SectionHeader', token: 'flex-col', statement: 'SectionHeader owns its collapse' }]; }), 'any finding is WRITE_REJECTED', 'a finding carried into a done receipt');
await expectError(withPlan((p) => { p.sweep.exitCode = 1; }), 'exited 1 with no finding recorded', 'a red sweep with an empty finding list');
await expectError(withPlan((p) => { p.sweep.findings = [{ code: 'OFF_SCALE', file: 'app/other/page.tsx', line: 3, object: '—', token: 'gap-5', statement: 'off the closed gap scale' }]; p.sweep.exitCode = 1; }), 'which the declared write set does not carry', 'the sweep read outside the write set');

// The checkout is not only what the branch wrote into it. The preflight ran before the first write, and
// the reflog entries the checkout gained while the branch held it are the branch's own commits and
// nothing else: a stash (which resets HEAD and outlives its own drop), a reset, a force, a clean or a
// checkout of another branch each leave one it never earned.
await expectError({ ...baseline(), 'response/changes.md': changesMd({ preflight: '—' }) }, 'records no Preflight', 'a source write with no preflight behind it');
await expectError({ ...baseline(), 'response/changes.md': changesMd({ preflight: 'failed at 2026-09-05T09:12:00Z' }) }, 'a done source-writing branch carries a preflight that passed', 'a done branch on a failed preflight');
await expectError({ ...baseline(), 'response/changes.md': changesMd({ reflogBefore: '—' }) }, 'carries no Reflog before', 'a receipt that never read the reflog');
await expectError({ ...baseline(), 'response/changes.md': changesMd({ reflogAfter: `HEAD 99 ${COMMIT}; stash 0` }) }, "a routed checkout gains only the branch's own commits", 'an entry the branch never earned');
await expectError({ ...baseline(), 'response/changes.md': changesMd({ reflogAfter: REFLOG_AFTER.replace('stash 0', 'stash 1') }) }, 'stash reflog went from 0 to 1 entries', 'a stash inside the routed checkout');

process.stdout.write('interface.generate self-test: lawful branches of all three receipts and rejected mutations passed\n');
