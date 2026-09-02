// Proves validate.mjs on a synthetic session branch: one conforming application on the session branch
// (one file modified, one application-owned leaf created, one path unchanged), one dry run that
// commits nothing, one blocked on WRITE_REJECTED with nothing written, and one mutation per law, each
// of which must fail with a line that names the defect.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateApplicationStep } from './validate.mjs';

const PAGE = 'app/plans/page.tsx';
const CANVAS = 'app/plans/canvas.tsx';
const LEGEND = 'app/plans/legend.tsx';
const BASE = '0f1e2d3c4b5a69788796a5b4c3d2e1f009182736';
const COMMIT = '9a8b7c6d5e4f30211203344556677889900aabbc';
const SESSION = 's-test';
const fp = (c) => `sha256:${c.repeat(64)}`;

const inventory = () => ({
  treeFingerprint: fp('a'),
  classNames: ['gap-6', 'gap-4'],
  ruleIds: ['GAP-5', 'GAP-4'],
  gaps: [],
});

const plan = ({ mode = 'apply', commit = COMMIT } = {}) => ({
  mode,
  base: BASE,
  branch: `session/${SESSION}`,
  commit,
  files: [
    { path: PAGE, change: 'modified', before: fp('b'), after: fp('c'), classes: ['gap-6'] },
    { path: CANVAS, change: 'created', before: null, after: fp('d'), classes: [] },
    { path: LEGEND, change: 'unchanged', before: fp('e'), after: fp('e'), classes: [] },
  ],
});

const dryPlan = () => ({
  mode: 'dry',
  base: BASE,
  branch: `session/${SESSION}`,
  commit: null,
  files: [
    { path: PAGE, change: 'modified', before: fp('b'), after: null, classes: ['gap-6'] },
    { path: CANVAS, change: 'created', before: null, after: null, classes: [] },
  ],
});

const responseMd = ({ mode = 'apply', commit = COMMIT, files } = {}) => {
  const rows = (files ?? plan().files).map(({ path: p, change, classes }) => `| \`${p}\` | ${change} | ${classes.length ? `\`${classes[0]}\`` : '—'} | ${classes.length ? '`GAP-5`' : '—'} | ${change === 'created' ? 'an application-owned leaf carrying its contract' : 'the resolved value for this node'} |`);
  return `# frontend-source-application — plan-picker

## Binding

| Field | Value |
| --- | --- |
| Target | \`plan-picker\` |
| Mode | \`${mode}\` |
| Branch | \`session/${SESSION}\` |
| Base | \`${BASE}\` |
| Commit | ${commit ? `\`${commit}\`` : '—'} |

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
  const rows = (files ?? plan().files).map(({ path: p, change, classes }) => `| \`${p}\` | ${change} | ${change === 'created' ? 'the application-owned leaf the direction marked' : 'the resolved value for this node'} | ${classes.length ? '`GAP-5`' : '—'} |`);
  return `# changes — frontend.source.apply step-3/parallel-1

The plans page and its application-owned canvas carry the resolved spacing on the session branch.

## Binding

| Field | Value |
| --- | --- |
| Operator | \`frontend.source.apply\` |
| Step | \`step-3/parallel-1\` |
| Checkout | \`@workspaces/fe\` at \`${BASE}\` → \`${COMMIT}\` on \`session/${SESSION}\` |
| Predecessor | \`step-2/parallel-1/response/response.md\` |

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

const requestJson = ({ extra = {} } = {}) => ({
  schemaVersion: 9,
  operatorId: 'frontend.source.apply',
  step: 3,
  parallel: 1,
  sessionId: SESSION,
  contexts: [{ alias: '@workspaces/fe', head: BASE }],
  requirements: { mode: 'apply', resume: null, ...extra },
  inputs: {
    'frontend-presentation-resolution': 'step-2/parallel-1/response/response.md',
    'frontend-direction-decision': 'step-1/parallel-1/response/response.md',
  },
  resume: null,
});

const responseJson = ({ status = 'done', stop, fields, commits = [COMMIT], next = ['frontend.surface.audit'] } = {}) => ({
  schemaVersion: 9,
  operatorId: 'frontend.source.apply',
  step: 3,
  parallel: 1,
  status,
  ...(stop ? { stop } : {}),
  fallbacks: [],
  fields: fields ?? { 'frontend-source-application': 'response/response.md', changes: 'response/changes.md', writes: 'response/data/writes.json' },
  commits,
  next,
});

function writeBranch(files, { inventoryDoc = inventory(), withInventory = true } = {}) {
  const session = mkdtempSync(path.join(tmpdir(), 'fe-apply-session-'));
  const branch = path.join(session, 'step-3', 'parallel-1');
  for (const d of ['request', 'response/data']) mkdirSync(path.join(branch, d), { recursive: true });
  const upstream = path.join(session, 'step-2', 'parallel-1', 'response', 'data');
  mkdirSync(upstream, { recursive: true });
  mkdirSync(path.join(session, 'step-1', 'parallel-1', 'response'), { recursive: true });
  writeFileSync(path.join(session, 'step-1', 'parallel-1', 'response', 'response.md'), '# frontend-direction-decision — plan-picker\n');
  writeFileSync(path.join(session, 'step-2', 'parallel-1', 'response', 'response.md'), '# frontend-presentation-resolution — plan-picker\n');
  if (withInventory) writeFileSync(path.join(upstream, 'inventory.json'), JSON.stringify(inventoryDoc, null, 2));
  writeFileSync(path.join(session, 'state.json'), JSON.stringify({ id: SESSION, chain: [['2/1'], ['3/1']], steps: { '2/1': 'frontend.presentation.resolve', '3/1': 'frontend.source.apply' }, current: '3/1', status: 'running' }));
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
  'response/changes.md': changesMd(),
  'response/data/writes.json': plan(),
});

const dryRun = () => ({
  'request/request.json': requestJson({ extra: { mode: 'dry' } }),
  'response/response.json': responseJson({ commits: [] }),
  'response/response.md': responseMd({ mode: 'dry', commit: null, files: dryPlan().files }),
  'response/changes.md': changesMd({ files: dryPlan().files }),
  'response/data/writes.json': dryPlan(),
});

async function expectValid(files, label, options) {
  const { branch, session } = writeBranch(files, options);
  const { errors } = await validateApplicationStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.deepEqual(errors, [], `${label} should be valid`);
}
async function expectError(files, needle, label, options) {
  const { branch, session } = writeBranch(files, options);
  const { errors } = await validateApplicationStep(branch);
  rmSync(session, { recursive: true, force: true });
  assert.ok(errors.some((e) => e.includes(needle)), `${label}: expected an error containing "${needle}", got:\n${errors.join('\n') || '(none)'}`);
}
const mutate = (change) => { const p = plan(); change(p); return { ...baseline(), 'response/data/writes.json': p }; };

await expectValid(baseline(), 'one modified path, one application-owned leaf created, one unchanged');
await expectValid(dryRun(), 'a dry run that commits nothing');
await expectValid({ 'request/request.json': requestJson(), 'response/response.json': responseJson({ status: 'blocked', stop: 'WRITE_REJECTED', commits: [], next: [], fields: {} }) }, 'blocked on WRITE_REJECTED with nothing written');

await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { mystery: 1 } }) }, 'requirements.mystery is not a field', 'undeclared requirement');
await expectError({ ...baseline(), 'request/request.json': requestJson({ extra: { mode: 'dry' } }) }, "mode apply differs from the request's dry", 'mode re-decided in the plan');
await expectError(mutate((p) => { p.files[0].classes = ['gap-8']; }), 'writes class gap-8, which the resolution never published', 'class the resolution never published');
await expectError(mutate((p) => { p.branch = 'mtp'; }), 'only session/<sessionId> may be committed to', 'write on the person\'s branch');
await expectError(mutate((p) => { p.branch = 'session/other'; }), 'is not the session branch of', 'write on another session branch');
await expectError(mutate((p) => { p.commit = null; }), 'commits the declared write set exactly once', 'applied run without a commit');
await expectError({ ...baseline(), 'response/response.json': responseJson({ commits: [COMMIT, BASE] }) }, 'records exactly one commit, found 2', 'two commits for one write set');
await expectError({ ...baseline(), 'response/response.json': responseJson({ commits: [BASE] }) }, 'is not the commit', 'response and plan disagree on the commit');
await expectError({ ...dryRun(), 'response/response.json': responseJson({ commits: [COMMIT] }) }, 'a dry run records no commit', 'dry run that committed');
await expectError({ ...dryRun(), 'response/data/writes.json': { ...dryPlan(), commit: COMMIT } }, 'a dry run commits nothing, so commit must be null', 'dry plan carrying a commit');
await expectError(mutate((p) => { p.files = p.files.map((f) => ({ ...f, change: 'unchanged', before: f.after ?? fp('e'), after: f.after ?? fp('e'), classes: [] })); }), 'moves at least one declared path', 'nothing moved');
await expectError(mutate((p) => { p.files[0].after = p.files[0].before; }), 'reports a modification with an unchanged hash', 'modification that did not move');
await expectError(mutate((p) => { p.files[1].before = fp('f'); }), 'was created but reports a prior hash', 'creation with a prior hash');
await expectError(mutate((p) => { p.files[2].classes = ['gap-6']; }), 'is reported unchanged while carrying classes', 'unchanged file carrying classes');
await expectError(mutate((p) => { p.files.push({ ...p.files[0] }); }), 'appears twice in the plan', 'one path planned twice');
await expectError({ ...baseline(), 'response/response.md': responseMd({ commit: BASE }) }, 'Commit', 'receipt and plan disagree on the commit');
await expectError({ ...baseline(), 'response/changes.md': changesMd().replace(`| \`${LEGEND}\` | unchanged | the resolved value for this node | — |\n`, '') }, 'Files lists 2 paths, the plan carries 3', 'changes.md hides a planned path');
await expectError({ ...baseline(), 'response/changes.md': changesMd().replace('| modified |', '| deleted |') }, 'is deleted here and modified in the plan', 'changes.md contradicts the plan');
await expectError({ ...baseline(), 'response/changes.md': changesMd().replace(` on \`session/${SESSION}\``, '') }, 'does not name the session branch', 'changes.md hides the session branch');
await expectError(baseline(), 'the resolution inventory could not be read', 'inventory missing beside the receipt', { withInventory: false });
await expectError({ ...baseline(), 'response/response.md': responseMd().replace('## Rejections', '## Rejected') }, 'missing section ^## Rejections$', 'receipt section renamed');
await expectError({ ...baseline(), 'response/data/writes.json': null, 'response/response.json': responseJson({ fields: { 'frontend-source-application': 'response/response.md', changes: 'response/changes.md' } }) }, 'required output writes is not in fields', 'missing required output');
await expectError({ ...baseline(), 'response/response.json': responseJson({ status: 'blocked', stop: 'MADE_UP_CODE', commits: [], next: [] }) }, 'not a registered code', 'unknown stop code');

process.stdout.write('frontend.source.apply self-test: 3 valid branches, 22 rejected mutations\n');
