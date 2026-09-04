// Proves validate.mjs on a synthetic session branch: one conforming resolution of a three-node tree
// (one application-owned gap, one Grammar-owned padding, one recorded gap), one branch with the
// contract emission off, one blocked on RULE_MISSING before anything was written, one whose gap rule
// claims no attribute because its node publishes no path for one, and one mutation per law, each of which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateResolutionStep } from './validate.mjs';

const TREE = 'response/artifacts/plan-picker.resolved.tsx';
const MAIN = 'body>main';
const SECTION = 'body>main>section';
const ASIDE = 'body>aside';
const FINGERPRINT = `sha256:${'a'.repeat(64)}`;

const inventory = () => ({
  treeFingerprint: FINGERPRINT,
  classNames: ['gap-6', 'gap-1'],
  ruleIds: ['GAP-5', 'GAP-1'],
  gaps: [{ nodePath: ASIDE, property: 'gap', missingPath: 'Common exposes no public path for the compact identity pair' }],
});

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

const responseMd = ({ gaps = 1, removed = 1 } = {}) => `# frontend-presentation-resolution — plan-picker

## Owner map

| Node | Property | Owner | Rule |
| --- | --- | --- | --- |
| \`${MAIN}\` | gap | app | \`GAP-5\` |
| \`${SECTION}\` | padding | grammar | \`PADDING-4\` |
| \`${ASIDE}\` | gap | app | \`GAP-1\` |

## Rules chosen

| Node | Rule | Class | Condition |
| --- | --- | --- | --- |
| \`${MAIN}\` | \`GAP-5\` | \`gap-6\` | region stack inside the page shell |
| \`${ASIDE}\` | \`GAP-1\` | \`gap-1\` | the compact identity pair |

## Removed

| Node | Class | Because |
| --- | --- | --- |
${removed ? `| \`${SECTION}\` | \`p-4\` | reimplements an owned relationship |` : ''}

## Gaps

| Node | Property | Missing path |
| --- | --- | --- |
${gaps ? `| \`${ASIDE}\` | gap | Common exposes no public path for the compact identity pair |` : ''}

## Fallbacks taken

| Code | Action |
| --- | --- |
`;

const requestJson = ({ extra = {} } = {}) => ({
  schemaVersion: 9,
  operatorId: 'frontend.presentation.resolve',
  step: 2,
  parallel: 1,
  sessionId: 's-test',
  contexts: [{ alias: '@knowledge/ui/presentation', head: null }, { alias: '@grammar/core', head: null }, { alias: '@workspaces/fe', head: 'd'.repeat(40) }],
  requirements: { maxRounds: 2, contractEmission: 'on', resume: null, ...extra },
  inputs: { 'frontend-direction-decision': 'step-1/parallel-1/response/response.md' },
  resume: null,
});

const responseJson = ({ status = 'done', stop, fields, fallbacks = [], next = ['frontend.source.apply'] } = {}) => ({
  schemaVersion: 9,
  operatorId: 'frontend.presentation.resolve',
  step: 2,
  parallel: 1,
  status,
  ...(stop ? { stop } : {}),
  fallbacks,
  fields: fields ?? { 'frontend-presentation-resolution': 'response/response.md', inventory: 'response/data/inventory.json', 'resolved-tree': TREE },
  commits: [],
  next,
});

// The direction this resolution consumes; a Decision table is present only when a delta is declared,
// because an older decision carries none and reads as app-owned.
const directionMd = (delta) => `# frontend-direction-decision — plan-picker\n${delta ? `\n## Decision\n\n| Field | Value |\n| --- | --- |\n| Presentation delta | \`${delta}\` |\n` : ''}`;

// A resolution that owes nothing: the direction declared Presentation delta none.
const noneReceipt = () => `# frontend-presentation-resolution — plan-picker

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
const noneInventory = () => ({ treeFingerprint: FINGERPRINT, classNames: [], ruleIds: [], gaps: [] });
const noneBranch = () => ({ ...baseline(), 'response/response.md': noneReceipt(), 'response/data/inventory.json': noneInventory(), [TREE]: resolvedTree({ emission: 'off' }) });

function writeBranch(files, direction = null) {
  const session = mkdtempSync(path.join(tmpdir(), 'fe-resolve-session-'));
  const branch = path.join(session, 'step-2', 'parallel-1');
  for (const d of ['request', 'response/data', 'response/artifacts']) mkdirSync(path.join(branch, d), { recursive: true });
  mkdirSync(path.join(session, 'step-1', 'parallel-1', 'response'), { recursive: true });
  writeFileSync(path.join(session, 'step-1', 'parallel-1', 'response', 'response.md'), directionMd(direction));
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: 's-test', project: 'starci-academy', startedAt: '2026-09-03T00:00:00Z', requestHashes: {}, chain: [['1/1'], ['2/1']], steps: { '1/1': 'frontend.direction.decide', '2/1': 'frontend.presentation.resolve' }, current: '2/1', status: 'running' }));
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
  'response/data/inventory.json': inventory(),
  [TREE]: resolvedTree(),
});

async function expectValid(files, label, direction = null) {
  const { branch, session } = writeBranch(files, direction);
  const { errors } = await validateResolutionStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label, direction = null) {
  const { branch, session } = writeBranch(files, direction);
  const { errors } = await validateResolutionStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}
const mutate = (change) => { const m = inventory(); change(m); return { ...baseline(), 'response/data/inventory.json': m }; };

await expectValid(baseline(), 'one application-owned gap, one Grammar-owned padding, one recorded gap');
await expectValid({ ...baseline(), 'request/request.json': requestJson({ extra: { contractEmission: 'off' } }), [TREE]: resolvedTree({ emission: 'off' }) }, 'contract emission off leaves the tree bare');
await expectValid({ 'request/request.json': requestJson(), 'response/response.json': responseJson({ status: 'blocked', stop: 'RULE_MISSING', next: [], fields: {} }) }, 'blocked on RULE_MISSING before anything was written');
await expectValid({ ...baseline(), [TREE]: resolvedTree().replace(' data-contract="GAP-1"', '') }, 'a rule whose only node is recorded under Gaps claims no attribute');
await expectValid(noneBranch(), 'a copy-only change under Presentation delta none resolves nothing', 'none');
await expectValid(baseline(), 'a declared app-owned delta resolves as before', 'app-owned');
await expectError(baseline(), 'declares Presentation delta none and the resolution still resolves', 'values resolved under a none delta', 'none');
await expectError({ ...noneBranch(), 'response/response.md': responseMd(), [TREE]: resolvedTree() }, 'declares Presentation delta none', 'receipt rows under a none delta', 'none');
await expectError(noneBranch(), 'cannot both be empty', 'nothing resolved under the default app-owned delta');
await expectError(baseline(), 'is neither app-owned nor none', 'an unknown delta value', 'cosmetic');

await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { mystery: 1 } }) }, 'requirements.mystery is not a field', 'undeclared requirement');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { maxRounds: 0 } }) }, 'maxRounds must be a positive whole number', 'no rounds allowed');
await expectError(mutate((m) => { m.ruleIds.push('GAP-99'); }), 'is outside the published presentation inventory', 'unpublished rule');
await expectError(mutate((m) => { m.classNames.push('gap-11'); }), 'is in the inventory and not in the resolved tree', 'class that never reached the tree');
await expectError(mutate((m) => { m.treeFingerprint = 'nope'; }), 'treeFingerprint', 'inventory schema');
await expectError({ ...baseline(), [TREE]: resolvedTree().replace(' data-contract="GAP-5"', '') }, 'no node claims it under data-contract', 'applied rule with no claim');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { contractEmission: 'off' } }) }, 'contract emission is off and the resolved tree carries a data-contract', 'claims written under emission off');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('| `body>main` | `GAP-5` | `gap-6` |', '| `body>main` | `GAP-5` | `gap-5` |'), 'response/data/inventory.json': (() => { const m = inventory(); m.classNames = ['gap-5', 'gap-1']; return m; })(), [TREE]: resolvedTree().replace('gap-6', 'gap-5') }, 'renders GAP-5 as gap-5, expected step 6', 'ordinal written as the step');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace(`| \`${SECTION}\` | padding | grammar | \`PADDING-4\` |`, `| \`${SECTION}\` | padding | app | \`PADDING-4\` |`) }, 'owns PADDING-4 and chooses no class for it', 'application claims an owned property and writes nothing');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace(`| \`${ASIDE}\` | \`GAP-1\` | \`gap-1\` | the compact identity pair |`, `| \`${SECTION}\` | \`PADDING-4\` | \`p-4\` | the card inset |`) }, 'chooses a class for PADDING-4, which Grammar already owns', 'application reimplements a Grammar relationship');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace(`| \`${MAIN}\` | gap | app | \`GAP-5\` |`, `| \`${MAIN}\` | gap | app | \`GAP-5\` |\n| \`${MAIN}\` | gap | app | \`GAP-4\` |`) }, 'decides gap more than once in the owner map', 'one property decided twice');
await expectError({ ...baseline(), 'response/response.md': responseMd({ gaps: 0 }) }, 'the Gaps table and inventory.gaps differ', 'gap recorded in data and not for the reader');
await expectError(mutate((m) => { m.gaps = []; }), 'the Gaps table and inventory.gaps differ', 'gap recorded for the reader and not in data');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('| `p-4` | reimplements an owned relationship |', '| `gap-6` | reimplements an owned relationship |') }, 'and the inventory still carries it', 'class removed and still inventoried');
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('## Removed', '## Deleted') }, 'missing section ^## Removed$', 'receipt section renamed');
await expectError({ ...baseline(), 'response/data/inventory.json': null, 'response/response.json': responseJson({ fields: { 'frontend-presentation-resolution': 'response/response.md', 'resolved-tree': TREE } }) }, 'required output inventory is not in fields', 'missing required output');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MADE_UP_CODE', next: [] }) }, 'not a registered code', 'unknown stop code');
await expectError({ ...baseline(), 'response/response.json': responseJson({ fallbacks: ['RULE_MISSING'] }) }, 'has disposition terminate under these requirements', 'a terminate code taken as a fallback');

process.stdout.write('frontend.presentation.resolve self-test: 6 valid branches, 22 rejected mutations\n');
