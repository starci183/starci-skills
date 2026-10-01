// Readable names (owner request 2026-09-27): a workflow has a display name (workflows.display_name, set at
// define-goal and by `api rename`), an op a Vietnamese label (modules/ops/_labels.yaml), and an op job the name
// `<op label> · <what> · <workflow name>`. workflow_id, op_id and job_id stay the keys; the names are what
// the [Kernel]/[Op] Orca tabs, api status, the supervisor digest, Telegram and the harness UI show.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { hasLedgerColumn } from '../../engine/db/ledger.mjs';
import {
  WORKFLOW_NAME_MAX, JOB_WHAT_MAX, deriveWorkflowDisplayName, jobDisplayName, jobDisplayNameOf, jobWhat, nodeLabel,
  normalizeDisplayName, opLabel, opLabelMap, pathLabel, productName, workflowDisplayName,
} from '../../scripts/lib/display-names.mjs';
import { orcaTreeFindings } from '../../scripts/supervisor/orca-tree.mjs';
import { askState } from '../../scripts/connectors/lib.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const OPS = path.join(ROOT, 'modules', 'ops', 'ops');
const out = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };

test('every op of modules/ops/ops has a vi and an en label, and nothing else is labelled', () => {
  const ops = fs.readdirSync(OPS).filter((f) => f.endsWith('.yaml')).map((f) => f.replace(/\.yaml$/, '')).sort();
  const labels = opLabelMap();
  assert.deepEqual(Object.keys(labels).sort(), ops, 'labels.yaml names exactly the op catalogue');
  for (const op of ops) {
    assert.ok(labels[op].vi?.trim() && labels[op].en?.trim(), `${op} has vi and en`);
    assert.notEqual(labels[op].vi, op, `${op}'s label is words, not its id`);
  }
  assert.equal(opLabel('interface.draw'), 'Vẽ giao diện');
  assert.equal(opLabel('uat.verify'), 'Kiểm thử UAT');
  assert.equal(opLabel('backend.implement'), 'Code backend');
  assert.equal(opLabel('workspace.manage#stacks'), opLabel('workspace.manage'), 'a leg instance reads as its op');
  assert.equal(opLabel('interface.draw', 'en'), 'Draw interface');
  assert.equal(opLabel('no.such-op'), 'no.such-op', 'an unknown op shows its id');
});

test('a derived workflow name is `<Product> · <first clause>`, at most 48 characters, else the slug', () => {
  assert.equal(productName('todo-app-be'), 'Todo App');
  assert.equal(productName('starci-be'), 'StarCi');
  assert.equal(deriveWorkflowDisplayName({ text: 'Đăng nhập & xác thực cho app. Thêm OAuth sau.', product: 'nivo', fallback: 'nivo-app-auth' }), 'Nivo · Đăng nhập & xác thực cho app');
  const long = deriveWorkflowDisplayName({ text: 'Xây dựng nền tảng học trực tuyến hoàn chỉnh gồm đăng ký, nội dung và thanh toán', product: 'todo-app-be', fallback: 'ta-foundation' });
  assert.ok(long.startsWith('Todo App · Xây dựng'), long);
  assert.ok(long.length <= WORKFLOW_NAME_MAX, `${long.length} <= ${WORKFLOW_NAME_MAX}`);
  assert.ok(long.endsWith('…'), 'a clipped name says so');
  assert.equal(deriveWorkflowDisplayName({ text: 'Nivo: module studio for creators', product: 'nivo', fallback: 'x' }), 'Nivo · Module studio for creators', 'the product is not repeated');
  assert.equal(deriveWorkflowDisplayName({ text: '...', product: 'nivo', fallback: 'nivo-app-auth' }), 'nivo-app-auth', 'nothing usable: the slug');
  assert.throws(() => normalizeDisplayName('   '), /empty/);
  assert.throws(() => normalizeDisplayName('x'.repeat(81)), /at most 80/);
  assert.equal(normalizeDisplayName('  Nivo ·\n Chat nhóm '), 'Nivo · Chat nhóm');
  assert.equal(workflowDisplayName({ workflow_id: 'wf-a', title: 'a-slug', display_name: null }), 'a-slug');
  assert.equal(workflowDisplayName({ workflow_id: 'wf-a', title: 'a-slug', display_name: 'Nivo · A' }), 'Nivo · A');
  assert.equal(workflowDisplayName({ workflow_id: 'wf-a', title: null }), 'wf-a');
});

test('what a job works on: explicit, then the work-graph node, the op-prefixed title, the feature path, the cut', () => {
  const nodes = [
    { id: 'login.foundation', domain: 'login', title: 'Reuse accepted Login rules, identity data, shared session and authentication presentation', ownedPaths: ['.starciwork/features/login/index.yaml'] },
    { id: 'login.sign-in', domain: 'login', title: 'Verify password and enrolled factor proof without disclosing account facts', ownedPaths: ['.starciwork/features/login/fr/sign-in', '.starciwork/features/login/uat/signin'] },
    { id: 'login.register', domain: 'login', title: 'Register', ownedPaths: ['.starciwork/features/login/fr/register'] },
  ];
  assert.equal(jobWhat({ payload: { displayWhat: 'Đăng nhập', owned_paths: ['.starciwork/features/login/uat/signin'] }, op: 'uat.verify', nodes }), 'Đăng nhập');
  assert.equal(jobWhat({ payload: { owned_paths: ['.starciwork/features/login/uat/signin'] }, op: 'uat.verify', nodes }), 'login / sign in', 'a sentence-long node title gives way to its id');
  assert.equal(jobWhat({ payload: { owned_paths: ['.starciwork/features/login/fr/register'] }, op: 'business.decide', nodes }), 'Register', 'a short node title is the name');
  assert.equal(jobWhat({ payload: { title: 'work.author instance-management.recovery', owned_paths: [] }, op: 'work.author' }), 'instance-management.recovery');
  assert.equal(jobWhat({ payload: { title: 'interface.draw', owned_paths: ['.starciwork/features/collab/ui/office'] }, op: 'interface.draw' }), 'collab / office');
  assert.equal(jobWhat({ payload: { title: 'backend.implement', cut: { id: 'collab-impl-be', ordinal: 2, total: 8 }, owned_paths: ['src/features/collab/composition'] }, op: 'backend.implement' }), 'collab / composition 2/8', 'a cut unit keeps its ordinal');
  assert.equal(jobWhat({ payload: { title: 'backend.implement', cut: { id: 'collab-impl-be', ordinal: 1, total: 3 }, owned_paths: [] }, op: 'backend.implement' }), 'collab impl be 1/3');
  assert.equal(jobWhat({ payload: { title: 'review.verify', owned_paths: ['.starciwork'] }, op: 'review.verify' }), null, 'a broad path names nothing');
  const long = jobWhat({ payload: { title: 'Repair TS18046 in workspace-purchase-flow.e2e-spec.ts:1045 (shared blocker for peers), then re-run the lane', owned_paths: [] }, op: 'e2e.verify' });
  assert.ok(long.length <= JOB_WHAT_MAX, long);
  assert.equal(pathLabel('.starciwork/features/instance-management/ui/owned-shell/module-ledger/evidence/draws.yaml'), 'instance management / module ledger');
  assert.equal(nodeLabel({ id: 'learning-paths.view-roadmap', domain: 'learning-paths' }), 'learning paths / view roadmap');
  assert.equal(jobDisplayName({ op: 'interface.draw', what: 'Mô-đun đã cài đặt', workflowName: 'Nivo · Mô-đun Todo' }), 'Vẽ giao diện · Mô-đun đã cài đặt · Nivo · Mô-đun Todo');
  assert.equal(jobDisplayName({ op: 'review.verify', what: null, workflowName: 'Nivo · Chuẩn hoá code FE' }), 'Review cuối · Nivo · Chuẩn hoá code FE');
});

test('a Work record title names the job when it is short; a folded `title: >-` reads whole', (t) => withLedger(t, ({ repoRoot }) => {
  const dir = path.join(repoRoot, '.starciwork', 'features', 'modules', 'ui', 'installed');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.yaml'), 'schema: work/ui-screen@1\nid: ui.modules.installed\ntitle: >-\n  Installed modules\nstate: todo\n');
  assert.equal(jobWhat({ payload: { owned_paths: ['.starciwork/features/modules/ui/installed'] }, op: 'interface.draw', repo: repoRoot }), 'Installed modules');
}));

const world = (t, fn) => withLedger(t, ({ root, repoRoot, machineHome, ledger }) => {
  const stub = path.join(root, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const stateFile = path.join(root, 'orca-state.json'), callsFile = path.join(root, 'calls.jsonl');
  fs.writeFileSync(stateFile, JSON.stringify({ sends: 0, terminals: {
    'term-k': { handle: 'term-k', connected: true, writable: true }, 'term-op': { handle: 'term-op', connected: true, writable: true } } }));
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE: 'healthy', STARCI_FAKE_ORCA_STATE: stateFile, STARCI_FAKE_ORCA_LOG: callsFile, LOCALAPPDATA: machineHome };
  delete env.ORCA_TERMINAL_HANDLE;
  const run = (args, extraEnv = {}) => spawnSync(process.execPath, [API, ...args, '--repo', repoRoot, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...env, ...extraEnv } });
  const calls = () => (fs.existsSync(callsFile) ? fs.readFileSync(callsFile, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line).argv) : []);
  seedWorkflow(ledger, { id: 'wf-nivo-app-auth-abc12345', state: { phase: 'running', job: 'nivo-app-auth' } });
  ledger.db.prepare("UPDATE workflows SET phase='running',title='nivo-app-auth',source_roots_json=? WHERE workflow_id=?").run(JSON.stringify([repoRoot]), 'wf-nivo-app-auth-abc12345');
  seedWorkflow(ledger, { id: 'wf-nivo-app-auth-abc12345', jobs: [
    { jobId: 'kernel-wf-nivo-app-auth-abc12345', kind: 'kernel', role: 'kernel', status: 'running', workerId: 'term-k',
      payload: { hierarchy: { role: 'kernel', runtime: { host: 'orca', agent: 'codex', terminalHandle: 'term-k' } } } },
    { jobId: 'op-uat.verify-1', opId: 'uat.verify', kind: 'op', status: 'running', workerId: 'term-op',
      payload: { opId: 'uat.verify', title: 'uat.verify', displayWhat: 'Đăng nhập', owned_paths: ['.starciwork/features/login/uat/signin'], orca: { agentTerminalHandle: 'term-op' } } },
  ] });
  ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,NULL,'tok-k',?,?,NULL)")
    .run('wf-nivo-app-auth-abc12345', JSON.stringify({ terminal: 'term-k' }), Date.now());
  return fn({ repoRoot, ledger, run, calls });
});

test('api rename sets the display name, records workflow-renamed and renames the live Kernel and op tabs', (t) => world(t, ({ ledger, run, calls }) => {
  const WF = 'wf-nivo-app-auth-abc12345';
  const dry = out(run(['rename', '--workflow', WF, '--title', 'Nivo · Đăng nhập & xác thực', '--dry-run']));
  assert.deepEqual([dry.dryRun, dry.changed, dry.kernelTerminal], [true, true, 'term-k']);
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='workflow-renamed'").get().n, 0, 'a dry run writes nothing');
  assert.deepEqual(calls().filter((argv) => argv[1] === 'rename'), [], 'and renames no tab');
  const r = run(['rename', '--workflow', WF, '--title', 'Nivo · Đăng nhập & xác thực', '--by', 'owner']);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const body = out(r);
  assert.deepEqual([body.title, body.from, body.slug, body.by, body.changed], ['Nivo · Đăng nhập & xác thực', null, 'nivo-app-auth', 'owner', true]);
  assert.ok(hasLedgerColumn(ledger.db, 'workflows', 'display_name'), 'the api migrated the additive column');
  const row = ledger.db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(WF);
  assert.deepEqual([row.workflow_id, row.title, row.display_name], [WF, 'nivo-app-auth', 'Nivo · Đăng nhập & xác thực'], 'the id and the slug never change');
  const events = ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='workflow-renamed'").all(WF).map((e) => JSON.parse(e.payload_json));
  assert.deepEqual(events.map((e) => [e.from, e.to, e.by]), [[null, 'Nivo · Đăng nhập & xác thực', 'owner']]);
  const renames = calls().filter((argv) => argv[0] === 'terminal' && argv[1] === 'rename').map((argv) => [argv[argv.indexOf('--terminal') + 1], argv[argv.indexOf('--title') + 1]]);
  assert.deepEqual(renames, [['term-k', '[Kernel] Nivo · Đăng nhập & xác thực'], ['term-op', '[Op] Kiểm thử UAT · Đăng nhập · Nivo · Đăng nhập & xác thực']]);
  assert.deepEqual(body.terminals.map((x) => [x.role, x.ok]), [['kernel', true], ['op', true]]);

  const again = out(run(['rename', '--workflow', WF, '--title', 'Nivo · Đăng nhập & xác thực', '--no-terminals']));
  assert.equal(again.changed, false, 'the same name writes nothing');
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='workflow-renamed'").get().n, 1);

  const status = out(run(['status', '--workflow', WF]));
  assert.deepEqual([status.workflowId, status.title, status.slug], [WF, 'Nivo · Đăng nhập & xác thực', 'nivo-app-auth']);
  for (const leg of status.legs) assert.equal(leg.label, opLabel(leg.op));

  const job = ledger.db.prepare("SELECT * FROM jobs WHERE job_id='op-uat.verify-1'").get();
  assert.equal(jobDisplayNameOf(ledger.db, job), 'Kiểm thử UAT · Đăng nhập · Nivo · Đăng nhập & xác thực');
}));

test('api rename refuses a bad name, a bad --by, an unknown workflow and an op caller', (t) => world(t, ({ run, ledger }) => {
  const WF = 'wf-nivo-app-auth-abc12345';
  const bad = run(['rename', '--workflow', WF, '--title', ' ', '--no-terminals']);
  assert.notEqual(bad.status, 0); assert.match(bad.stderr, /rename-bad-title/);
  const by = run(['rename', '--workflow', WF, '--title', 'Nivo · X', '--by', 'kernel', '--no-terminals']);
  assert.notEqual(by.status, 0); assert.match(by.stderr, /rename-bad-by/);
  const unknown = run(['rename', '--workflow', 'wf-nope', '--title', 'Nivo · X', '--no-terminals']);
  assert.notEqual(unknown.status, 0); assert.match(unknown.stderr, /workflow-unknown/);
  ledger.db.prepare('UPDATE jobs SET worker_id=? WHERE job_id=?').run('term-op', 'op-uat.verify-1');
  const op = run(['rename', '--workflow', WF, '--title', 'Nivo · X', '--no-terminals'], { ORCA_TERMINAL_HANDLE: 'term-op' });
  assert.notEqual(op.status, 0); assert.match(op.stderr, /op-context-refused/);
}));

test('the orca-tree check never identifies a kernel by its [Kernel] tab title, display name or not', (t) => withLedger(t, ({ ledger }) => {
  seedWorkflow(ledger, { id: 'wf-tree-named', state: { phase: 'running', job: 'tree-slug' } });
  ledger.db.prepare("UPDATE workflows SET phase='running', display_name='Nivo · Cây' WHERE workflow_id='wf-tree-named'").run();
  const term = (handle, title) => ({ handle, title, live: true, worktreePath: null });
  // Former false positive: two tabs titled with the workflow's display name read as a duplicate kernel.
  const dup = orcaTreeFindings(ledger.db, [term('t1', '[Kernel] Nivo · Cây'), term('t2', '[Kernel] Nivo · Cây')], { owned: new Set() });
  assert.deepEqual(dup.filter((f) => f.code === 'DUPLICATE_KERNEL'), []);
  const foreign = orcaTreeFindings(ledger.db, [term('t9', '[Kernel] Todo App · Nền tảng')], { owned: new Set() });
  assert.deepEqual(foreign.filter((f) => f.terminal === 't9'), [], 'another ledger\'s kernel is not this ledger\'s orphan');
}));

test('a Telegram ask names the workflow by its display name and the asking job by its name', (t) => withLedger(t, ({ ledger }) => {
  seedWorkflow(ledger, { id: 'wf-ask-named', state: { phase: 'running', job: 'ask-slug' }, jobs: [
    { jobId: 'op-interface.draw-1', opId: 'interface.draw', kind: 'op', status: 'answering', dispatchId: 'ask-1', payload: { opId: 'interface.draw', displayWhat: 'Mô-đun đã cài đặt' } },
  ] });
  ledger.db.prepare("UPDATE workflows SET display_name='Nivo · Mô-đun Todo' WHERE workflow_id='wf-ask-named'").run();
  const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get('op-interface.draw-1').attempt_id;
  ledger.db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES(?,?,?,?,'ask',?,?)")
    .run('wf-ask-named', attemptId, 'ask-1', 'op-interface.draw-1', JSON.stringify({ outcome: 'ask', question: { text: 'Duyệt?', options: ['ok'] } }), Date.now());
  const view = askState(ledger.db, 'wf-ask-named', 'ask-1');
  assert.equal(view.title, 'Nivo · Mô-đun Todo');
  assert.equal(view.jobName, 'Vẽ giao diện · Mô-đun đã cài đặt · Nivo · Mô-đun Todo');
}));
