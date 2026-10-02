import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';
import { readFoundation } from '../../scripts/kernel/foundation-registry.mjs';
import { FOUNDATION_WAIT, SHELL_FOUNDATION, gateShellFoundation, landShellFoundationIfSettled, shellFoundationNeed, shellFoundationWaitOf } from '../../scripts/kernel/shell-foundation.mjs';
import { checkPrerequisites, prerequisiteDetail, DESIGN_NOT_SETTLED } from '../../scripts/kernel/prerequisites.mjs';
import { nodeById, treeOf } from '../../scripts/work/layout-tree.mjs';
import { settledProduct, uiSkeleton } from '../fixtures/layout-tree.mjs';

// Owner ruling 2026-09-29 (draw-from-todo): interface.draw starts from a todo shell; the shell + ancestor layouts are ONE
// shared foundation across the workflows of a project. The first draw claims it and draws the parents in its own op, a draw
// of another live workflow waits (foundation-wait) instead of drafting a second shell, a stalled owner opens a Supervisor
// Decision Item, and a passed draw lands the foundation once the tree is settled. Code is never built before its design.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CONSOLE = '/[locale]/(console)';
const BOARD = '.starciwork/features/reports/ui/board';
const DRAW = parseYaml(fs.readFileSync(path.join(ROOT, 'modules/ops/ops/interface.draw.yaml'), 'utf8'));
const IMPLEMENT = parseYaml(fs.readFileSync(path.join(ROOT, 'modules/ops/ops/interface.implement.yaml'), 'utf8'));
const brief = { reads: DRAW.reads.filter((r) => !r.directionArchetype), graphPolicy: { prerequisiteState: 'never' } };
const A = 'wf-shell-a', B = 'wf-shell-b';

function ledgerFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-shell-foundation-'));
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  const file = ledgerFileFor(repo, { env: { ...process.env, LOCALAPPDATA: path.join(root, 'localappdata') } });
  const ledger = openLedger({ file });
  t.after(() => { try { ledger.close(); } catch { /* closed */ } fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  for (const workflowId of [A, B]) {
    ledger.ensureWorkflow({ workflowId, title: workflowId, ledgerMode: 'durable', sourceRoots: [repo] });
    ledger.write.changeWorkflowPhase({ workflowId, to: 'running', by: 'test-fixture', reason: 'seed' });
  }
  return { ledger, file, repo };
}
const need = (reasons = ['/[locale]/(console): layout is todo, not done']) => ({ needed: true, reasons });

test('interface.draw starts from todo: no shell prerequisite, it writes the layout tree, every screen is drawn', (t) => {
  const shell = DRAW.reads.find((r) => r.id === 'shell');
  assert.equal(shell.mustExist, undefined);
  assert.equal(shell.layoutChain, undefined);
  assert.equal(shell.layoutFoundation, true);
  assert.ok(DRAW.writes.some((w) => w.id === 'shellNode'));
  assert.ok(DRAW.writes.some((w) => w.id === 'shellAssets'));
  assert.equal(DRAW.params.representativeScreensMax, undefined, 'no sampling of screens: every screen of the scope is drawn');
  assert.match(DRAW.goal.en, /Draw EVERY screen/);
  assert.doesNotMatch(JSON.stringify(DRAW.route.prerequisites), /layout-unsettled|layoutChain|every layout above/);
  assert.match(DRAW.route.prerequisites.join('|'), /brand\.decide done \(the brand record and its direction, never the layouts/, 'brand.decide stays for the brand record only, never for layouts');
  assert.match(DRAW.route.prerequisites.join('\n'), /todo or absent layout tree is admitted/);
  // The prerequisites engine itself admits the draw: a ui record whose layout tree is still todo raises no gate.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-draw-todo-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const repo = path.join(root, 'repo');
  fs.mkdirSync(path.join(repo, '.starciwork', 'features', 'reports', 'ui', 'board'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.starciwork', 'features', 'reports', 'ui', 'board', 'index.yaml'),
    'schema: work/ui-screen@1\nid: ui.reports.board\ntitle: Board\n');
  const admitted = checkPrerequisites({ brief, repo, payload: { records: [BOARD], owned_paths: [BOARD] } });
  assert.deepEqual(admitted.unmet, [], `no layout prerequisite fires on a todo tree: ${JSON.stringify(admitted.unmet)}`);
});

test('the first draw with parents to draw claims foundation shell; a second workflow waits and never drafts a second shell', (t) => {
  const { ledger } = ledgerFixture(t);
  const jobA = { workflow_id: A, job_id: 'job-a' }, jobB = { workflow_id: B, job_id: 'job-b' };
  const first = gateShellFoundation(ledger, { job: jobA, need: need(), now: 1000 });
  assert.equal(first.action, 'claimed');
  assert.equal(readFoundation(ledger.db, SHELL_FOUNDATION).owner.workflowId, A);
  assert.equal(readFoundation(ledger.db, SHELL_FOUNDATION).kind, 'layout-tree');
  assert.equal(gateShellFoundation(ledger, { job: jobA, need: need(), now: 2000 }).action, 'owner', 'a retry of the owner draws on');
  const wait = gateShellFoundation(ledger, { job: jobB, need: need(), now: 3000 });
  assert.equal(wait.action, 'wait');
  assert.equal(wait.owner, A);
  assert.equal(wait.decision, undefined, 'inside the stall limit no Decision Item is opened');
  assert.deepEqual(readFoundation(ledger.db, SHELL_FOUNDATION).dependents.map((d) => d.workflowId), [B]);
  assert.equal(FOUNDATION_WAIT, 'foundation-wait');
  assert.match(shellFoundationWaitOf(ledger.db, B).detail, /never a second shell draft/);
  assert.equal(shellFoundationWaitOf(ledger.db, A), null, 'the owner does not wait on itself');
});

test('an owner past the stall limit opens a Supervisor Decision Item (idempotent); a stopped owner hands the shell over', (t) => {
  const { ledger } = ledgerFixture(t);
  gateShellFoundation(ledger, { job: { workflow_id: A, job_id: 'job-a' }, need: need(), now: 1000 });
  const late = 1000 + 3 * 60 * 60 * 1000;
  const stalled = gateShellFoundation(ledger, { job: { workflow_id: B, job_id: 'job-b' }, need: need(), now: late });
  assert.equal(stalled.action, 'wait');
  assert.ok(stalled.decision, 'the Supervisor is told');
  const again = gateShellFoundation(ledger, { job: { workflow_id: B, job_id: 'job-b' }, need: need(), now: late + 1000 });
  assert.equal(again.decision, stalled.decision, 'one Decision Item per stalled claim');
  const row = ledger.db.prepare('SELECT kind, decider FROM decision_items WHERE di_id=?').get(stalled.decision);
  assert.equal(row.kind, 'cross-workflow');
  assert.equal(row.decider, 'supervisor');
  // The owner stops running: the waiting workflow claims the foundation and draws the parents itself.
  ledger.write.changeWorkflowPhase({ workflowId: A, to: 'paused', by: 'test-fixture', reason: 'stop' });
  const taken = gateShellFoundation(ledger, { job: { workflow_id: B, job_id: 'job-b' }, need: need(), now: late + 2000 });
  assert.equal(taken.action, 'claimed');
  assert.equal(taken.transferredFrom, A);
});

test('a passed draw lands the foundation only when the tree is settled, and releases the dependents', async (t) => {
  const { ledger } = ledgerFixture(t);
  const p = await settledProduct(t);
  const repo = path.dirname(p.work);
  const unsettled = structuredClone(p.record);
  nodeById(treeOf(unsettled, 'app'), CONSOLE).layout.state = 'todo';
  p.save(unsettled);
  const jobA = { workflow_id: A, job_id: 'job-a' };
  const gate = gateShellFoundation(ledger, { job: jobA, need: shellFoundationNeed({ brief, repo, payload: { owned_paths: [BOARD] } }), now: 1000 });
  assert.equal(gate.action, 'claimed');
  gateShellFoundation(ledger, { job: { workflow_id: B, job_id: 'job-b' }, need: need(), now: 1500 });
  const notYet = landShellFoundationIfSettled(ledger, { job: jobA, brief, payload: { owned_paths: [BOARD] }, repo, now: 2000 });
  assert.equal(notYet.landed, false, 'the layout is still todo: nothing lands');
  assert.equal(readFoundation(ledger.db, SHELL_FOUNDATION).state, 'claimed');
  p.save(p.tree);
  const landed = landShellFoundationIfSettled(ledger, { job: jobA, brief, payload: { owned_paths: [BOARD] }, repo, now: 3000 });
  assert.deepEqual(landed, { landed: true, dependents: [B] });
  assert.equal(readFoundation(ledger.db, SHELL_FOUNDATION).state, 'landed');
  assert.equal(shellFoundationWaitOf(ledger.db, B), null, 'the dependent is released');
  assert.equal(landShellFoundationIfSettled(ledger, { job: { workflow_id: B, job_id: 'job-b' }, brief, payload: { owned_paths: [BOARD] }, repo }), null, 'only the owner lands it');
});

test('hard design gate: interface.implement is refused until the ui record it proves has a settled draw (DESIGN_NOT_SETTLED)', (t) => {
  const draws = IMPLEMENT.reads.find((r) => r.id === 'draws');
  assert.equal(draws.designDrawn, true);
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-design-gate-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const write = (rel, text) => { const file = path.join(repo, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  const impl = '.starciwork/features/reports/impl/web/board';
  write(`${impl}/index.yaml`, stringifyYaml({ schema: 'work/implementation@1', id: 'impl.reports.web.board', state: 'todo', repository: 'web', proves: ['ui.reports.board'] }));
  const gate = () => checkPrerequisites({ brief: { reads: IMPLEMENT.reads.filter((r) => r.id === 'draws'), graphPolicy: { prerequisiteState: 'never' } }, repo, payload: { records: [impl] } });
  const missing = gate().unmet;
  assert.equal(missing.length, 1);
  assert.equal(missing[0].kind, 'design-not-settled');
  assert.equal(missing[0].code, DESIGN_NOT_SETTLED);
  assert.match(missing[0].why, /does not exist/);
  const detail = prerequisiteDetail({ op: 'interface.implement', jobId: 'j1', unmet: missing });
  assert.match(detail, /DESIGN_NOT_SETTLED/);
  assert.match(detail, /ch\u01b0a \u0111\u01b0\u1ee3c ch\u1ed1t n\u00ean ch\u01b0a \u0111\u01b0\u1ee3c vi\u1ebft code/);
  // Drawn but not yet accepted (state todo): still refused.
  const ui = uiSkeleton('ui.reports.board', { route: `${CONSOLE}/reports`, surface: 'page' });
  write('.starciwork/features/reports/ui/board/index.yaml', stringifyYaml({ ...ui, state: 'todo' }));
  assert.match(gate().unmet[0].why, /todo, not done/);
  // Settled pass: the record is done - the implement is admitted.
  write('.starciwork/features/reports/ui/board/index.yaml', stringifyYaml({ ...ui, state: 'done' }));
  assert.deepEqual(gate().unmet, []);
  // A record that proves no ui record is not this gate's business.
  write(`${impl}/index.yaml`, stringifyYaml({ schema: 'work/implementation@1', id: 'impl.reports.web.board', state: 'todo', repository: 'web', proves: ['fr.reports.x'] }));
  assert.deepEqual(gate().unmet, []);
});

test('the ledger writers stay the only route into foundations (ledger opens and closes cleanly)', (t) => {
  const { ledger, file } = ledgerFixture(t);
  gateShellFoundation(ledger, { job: { workflow_id: A, job_id: 'job-a' }, need: need(), now: 1 });
  ledger.close();
  const inspect = inspectLedger({ file });
  try { assert.equal(inspect.db.prepare("SELECT count(*) n FROM foundations WHERE name='shell'").get().n, 1); } finally { inspect.close(); }
});
