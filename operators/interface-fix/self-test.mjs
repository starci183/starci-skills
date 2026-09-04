// Proves validate.mjs on a synthetic session branch: one conforming fix of one audit verdict row (one
// path modified on the session branch, values from the generator's inventory), one fix of a UAT
// verdict, one dry run, one blocked on FIX_TOO_LARGE with nothing written, and one mutation per law,
// each of which must fail with a line that names the defect. The fix-size check is exercised through
// its own function with an explicit size, because the threshold is the orchestrator's and this test
// hard-codes none.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateFixStep, fixSizeErrors } from './validate.mjs';
import { fingerprintOf } from '../interface-generate/validate.mjs';

const HEAD = '9a8b7c6d5e4f30211203344556677889900aabbc';
const COMMIT = '1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d';
const SESSION = 's-test';
const BT = String.fromCharCode(96);
const fp = (c) => `sha256:${c.repeat(64)}`;
const PAGE = 'app/plans/page.tsx';
const LEGEND = 'app/plans/legend.tsx';
const TREE = 'response/artifacts/plan-picker.resolved.tsx';
const RUN_ID = '20260904-101500-abc1234';
const AUDIT_FINDING = `narrow-light-loaded/body>main/GAP-5`;
const UAT_FINDING = `${RUN_ID}/choose-plan`;

// The generator's branch this fix takes its values from: step-2/parallel-1, with the inventory frozen
// beside the resolved tree; the audit that raised the finding is step-3/parallel-1; a UAT walk that
// raised one is step-4/parallel-1.
const tree = `export default function PlanPicker() {
  return (
    <main className="gap-6" data-contract="GAP-5">
      <SurfaceCard />
    </main>
  );
}
`;
const inventory = (t = tree) => ({ treeFingerprint: fingerprintOf(Buffer.from(t, 'utf8')), classNames: ['gap-6', 'gap-4'], ruleIds: ['GAP-5', 'GAP-4'], gaps: [] });
const auditMd = () => `# frontend-surface-audit — plan-picker

## Regressions

| Matrix | Node | Rule | Measured | Routes to |
| --- | --- | --- | --- | --- |
| narrow-light-loaded | body>main | GAP-5 | 1rem | resolve |
`;
const uatMd = () => `# uat-flow-verification — checkout/happy

## Verdicts

| Step | Verdict | Evidence |
| --- | --- | --- |
| choose-plan | fail | the plan card never confirms |
`;

const cleanSweep = () => ({ command: 'node scripts/sweep-presentation.mjs . --write-set response/data/write-set.txt --json', exitCode: 0, findings: [], output: 'sweep-presentation: clean, 2 file(s)' });
const plan = ({ mode = 'apply', commit = COMMIT, files } = {}) => ({
  mode, base: HEAD, branch: `session/${SESSION}`, commit, sweep: cleanSweep(),
  files: files ?? [
    { path: PAGE, change: 'modified', before: fp('b'), after: mode === 'dry' ? null : fp('c'), classes: ['gap-6'] },
    { path: LEGEND, change: 'unchanged', before: fp('e'), after: fp('e'), classes: [] },
  ],
});
const applicationMd = ({ mode = 'apply', commit = COMMIT, finding = AUDIT_FINDING, files } = {}) => {
  const rows = (files ?? plan({ mode }).files).map(({ path: p, change, classes }) => `| ${BT}${p}${BT} | ${change} | ${classes.length ? `${BT}${classes[0]}${BT}` : '—'} | ${classes.length ? `${BT}GAP-5${BT}` : '—'} | the resolved value for this node |`);
  return `# frontend-source-application — plan-picker

## Binding

| Field | Value |
| --- | --- |
| Target | ${BT}plan-picker${BT} |
| Finding | ${BT}${finding}${BT} |
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
`;
};
const changesMd = ({ files } = {}) => {
  const rows = (files ?? plan().files).map(({ path: p, change, classes }) => `| ${BT}${p}${BT} | ${change} | the resolved value for this node | ${classes.length ? `${BT}GAP-5${BT}` : '—'} |`);
  return `# changes — interface.fix step-5/parallel-1

One finding repaired on the session branch from the generator's inventory.

## Binding

| Field | Value |
| --- | --- |
| Operator | ${BT}interface.fix${BT} |
| Step | ${BT}step-5/parallel-1${BT} |
| Checkout | ${BT}@workspaces/fe${BT} at ${BT}${HEAD}${BT} → ${BT}${COMMIT}${BT} on ${BT}session/${SESSION}${BT} |
| Predecessor | ${BT}step-3/parallel-1/response/response.md${BT} |

## Files

| Path | Change | Why | Claims |
| --- | --- | --- | --- |
${rows.join('\n')}

## What the next step must know

- Gates to run: the lint and type gates the checkout pins for these paths.
- Surfaces to observe: the /plans route at the narrow branch.
`;
};

const requestJson = ({ extra = {}, inputs } = {}) => ({
  schemaVersion: 9, operatorId: 'interface.fix', step: 5, parallel: 1, sessionId: SESSION,
  contexts: [{ alias: '@workspaces/fe', head: HEAD }],
  requirements: { finding: AUDIT_FINDING, mode: 'apply', resume: null, ...extra },
  inputs: inputs ?? {
    'frontend-presentation-resolution': 'step-2/parallel-1/response/resolution.md',
    'frontend-source-application': 'step-2/parallel-1/response/response.md',
    'frontend-surface-audit': 'step-3/parallel-1/response/response.md',
  },
  resume: null,
});
const UAT_INPUTS = {
  'frontend-presentation-resolution': 'step-2/parallel-1/response/resolution.md',
  'frontend-source-application': 'step-2/parallel-1/response/response.md',
  'uat-flow-verification': 'step-4/parallel-1/response/response.md',
};
const responseJson = ({ status = 'done', stop, fields, commits = [COMMIT], next = ['interface.audit'] } = {}) => ({
  schemaVersion: 9, operatorId: 'interface.fix', step: 5, parallel: 1, status, ...(stop ? { stop } : {}), fallbacks: [],
  fields: fields ?? { 'frontend-source-application': 'response/response.md', changes: 'response/changes.md', writes: 'response/data/writes.json' },
  commits: status === 'done' ? commits : [], next: status === 'done' ? next : [],
});

function writeBranch(files, { producerInventory = inventory(), producerTree = tree, producerTreeListed = true } = {}) {
  const session = mkdtempSync(path.join(tmpdir(), 'interface-fix-session-'));
  const branch = path.join(session, 'step-5', 'parallel-1');
  for (const d of ['request', 'response/data']) mkdirSync(path.join(branch, d), { recursive: true });
  const generated = path.join(session, 'step-2', 'parallel-1', 'response');
  mkdirSync(path.join(generated, 'data'), { recursive: true });
  mkdirSync(path.join(generated, 'artifacts'), { recursive: true });
  writeFileSync(path.join(generated, 'resolution.md'), '# frontend-presentation-resolution — plan-picker\n');
  writeFileSync(path.join(generated, 'response.md'), '# frontend-source-application — plan-picker\n');
  writeFileSync(path.join(generated, 'data', 'inventory.json'), JSON.stringify(producerInventory, null, 2));
  writeFileSync(path.join(generated, 'artifacts', 'plan-picker.resolved.tsx'), producerTree);
  writeFileSync(path.join(generated, 'response.json'), JSON.stringify({ schemaVersion: 9, operatorId: 'interface.generate', step: 2, parallel: 1, status: 'done', fallbacks: [], fields: producerTreeListed ? { 'resolved-tree': TREE } : {}, commits: [HEAD], next: [] }));
  for (const [step, text] of [[3, auditMd()], [4, uatMd()]]) {
    const dir = path.join(session, `step-${step}`, 'parallel-1', 'response');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'response.md'), text);
  }
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: SESSION, project: 'starci-academy', startedAt: '2026-09-04T00:00:00Z', requestHashes: {}, chain: [['2/1'], ['3/1'], ['4/1'], ['5/1']], steps: { '2/1': 'interface.generate', '3/1': 'interface.audit', '4/1': 'uat.verify', '5/1': 'interface.fix' }, current: '5/1', status: 'running' }));
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    writeFileSync(path.join(branch, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return { branch, session };
}

const baseline = () => ({
  'request/request.json': requestJson(),
  'response/response.json': responseJson(),
  'response/response.md': applicationMd(),
  'response/changes.md': changesMd(),
  'response/data/writes.json': plan(),
});
const dryRun = () => ({
  ...baseline(),
  'request/request.json': requestJson({ extra: { mode: 'dry' } }),
  'response/response.json': responseJson({ commits: [] }),
  'response/response.md': applicationMd({ mode: 'dry', commit: null }),
  'response/changes.md': changesMd({ files: plan({ mode: 'dry' }).files }),
  'response/data/writes.json': plan({ mode: 'dry', commit: null }),
});
const uatFix = () => ({
  ...baseline(),
  'request/request.json': requestJson({ extra: { finding: UAT_FINDING }, inputs: UAT_INPUTS }),
  'response/response.json': responseJson({ next: ['uat.verify'] }),
  'response/response.md': applicationMd({ finding: UAT_FINDING }),
});

async function expectValid(files, label, options) {
  const { branch, session } = writeBranch(files, options);
  const { errors } = await validateFixStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label, options) {
  const { branch, session } = writeBranch(files, options);
  const { errors } = await validateFixStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}
const withPlan = (change) => { const p = plan(); change(p); return { ...baseline(), 'response/data/writes.json': p }; };

await expectValid(baseline(), 'one audit verdict row repaired on the session branch from the generator\'s inventory');
await expectValid(uatFix(), 'one UAT verdict repaired and handed back to the walk');
await expectValid(dryRun(), 'a dry run that commits nothing');
await expectValid({ 'request/request.json': requestJson(), 'response/response.json': responseJson({ status: 'blocked', stop: 'FIX_TOO_LARGE', fields: {} }) }, 'blocked on FIX_TOO_LARGE with nothing written');
await expectValid({ 'request/request.json': requestJson(), 'response/response.json': responseJson({ status: 'blocked', stop: 'RESOLUTION_STALE', fields: {} }) }, 'blocked on RESOLUTION_STALE with nothing written');

// The finding.
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { finding: '' } }) }, 'required field finding has no value', 'a fix with no finding');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { finding: 'the narrow gap looks off' } }) }, 'is neither <matrixId>/<node>/<rule>', 'a finding in prose');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { finding: 'wide-light-loaded/body>main/GAP-5' } }) }, 'is no row of ## Regressions', 'a finding the audit never recorded');
await expectError({ ...baseline(), 'request/request.json': requestJson({ inputs: { 'frontend-presentation-resolution': 'step-2/parallel-1/response/resolution.md', 'frontend-source-application': 'step-2/parallel-1/response/response.md' } }) }, 'neither frontend-surface-audit nor uat-flow-verification', 'a fix answering a finding nobody raised');
await expectError({ ...baseline(), 'request/request.json': requestJson({ inputs: { ...requestJson().inputs, 'uat-flow-verification': 'step-4/parallel-1/response/response.md' } }) }, 'both frontend-surface-audit and uat-flow-verification', 'a fix answering two receipts');
await expectError({ ...uatFix(), 'request/request.json': requestJson({ extra: { finding: `${RUN_ID}/pay` }, inputs: UAT_INPUTS }) }, 'is no row of ## Verdicts', 'a UAT step the walk never recorded');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { finding: UAT_FINDING } }) }, 'names a UAT verdict and inputs carry no uat-flow-verification', 'a UAT finding with the audit as input');
await expectError({ ...baseline(), 'response/response.md': applicationMd({ finding: 'wide-light-loaded/body>main/GAP-5' }) }, 'the receipt repeats the one finding it answers', 'a receipt naming another finding than the request bound');
await expectError({ ...baseline(), 'response/response.md': applicationMd().replace(`| Finding | ${BT}${AUDIT_FINDING}${BT} |\n`, '') }, 'Binding names the finding (absent)', 'a receipt that names no finding');

// The bound resolution.
await expectError(baseline(), 'RESOLUTION_STALE', 'an inventory frozen for another tree than the one beside it', { producerInventory: { ...inventory(), treeFingerprint: fp('9') } });
await expectError(baseline(), 'read beside no resolved tree', 'an inventory whose producer lists no resolved tree', { producerTreeListed: false });
await expectError(withPlan((p) => { p.files[0].classes = ['gap-8']; }), 'which the resolution never published', 'a class the inventory does not publish');

// The shape of a fix.
await expectError(withPlan((p) => { p.files.push({ path: 'app/plans/canvas.tsx', change: 'created', before: null, after: fp('d'), classes: [] }); }), 'a fix creates and deletes nothing', 'a fix that creates a path');
await expectError(withPlan((p) => { p.files[1] = { path: LEGEND, change: 'deleted', before: fp('e'), after: null, classes: [] }; }), 'a fix creates and deletes nothing', 'a fix that deletes a path');
// The threshold is the orchestrator's: with a published size the moved paths stay inside it, without
// one the shape alone is checked.
const wide = plan({ files: [1, 2, 3].map((n) => ({ path: `app/plans/${n}.tsx`, change: 'modified', before: fp('a'), after: fp('b'), classes: [] })) });
assert.ok(fixSizeErrors({ at: 'response/data/writes.json', plan: wide, size: { maxFiles: 2 } }).some((e) => e.includes('FIX_TOO_LARGE')), 'three moved paths over a fix size of two');
assert.deepEqual(fixSizeErrors({ at: 'response/data/writes.json', plan: wide, size: null }), [], 'no published size checks the shape alone');
assert.deepEqual(fixSizeErrors({ at: 'response/data/writes.json', plan: plan(), size: { maxFiles: 2 } }), [], 'one moved path inside a fix size of two');

// The generator's write law, bound here unchanged.
await expectError(withPlan((p) => { p.branch = 'mtp'; }), 'only session/<sessionId> may be committed to', 'write on the person\'s branch');
await expectError(withPlan((p) => { p.commit = null; }), 'commits the declared write set exactly once', 'applied run without a commit');
await expectError({ ...baseline(), 'response/response.json': responseJson({ commits: [COMMIT, HEAD] }) }, 'records exactly one commit, found 2', 'two commits for one fix');
await expectError({ ...dryRun(), 'response/response.json': responseJson({ commits: [COMMIT] }) }, 'a dry run records no commit', 'dry run that committed');
await expectError(withPlan((p) => { delete p.sweep; }), 'records the presentation sweep', 'a fix with no sweep');
await expectError(withPlan((p) => { p.sweep.findings = [{ code: 'APP_OVERRIDE', file: PAGE, line: 4, object: 'Card', token: 'p-2', statement: 'reaches into Card' }]; }), 'any finding is WRITE_REJECTED', 'a sweep finding carried into a done receipt');
await expectError({ ...baseline(), 'response/changes.md': changesMd().replace('interface.fix step-5', 'interface.generate step-5') }, 'names another operator', 'changes.md signed by the generator');
await expectError({ ...baseline(), 'response/changes.md': changesMd({ files: [plan().files[0]] }) }, 'Files lists 1 paths, the plan carries 2', 'changes.md hides a planned path');
await expectError({ ...baseline(), 'response/response.md': applicationMd().replace('## Rejections', '## Rejected') }, 'missing section ^## Rejections$', 'receipt section renamed');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MADE_UP_CODE' }) }, 'not a registered code', 'unknown stop code');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { mystery: 1 } }) }, 'requirements.mystery is not a field', 'undeclared requirement');

process.stdout.write('interface.fix self-test: 5 valid branches, the fix-size rule and rejected mutations passed\n');
