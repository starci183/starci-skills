// replay-world.mjs - the throwaway world a replay spec (tests/replay/*.spec.mjs) runs the REAL runtime in.
//
// A replay fixture (tests/fixtures/replay/<case>.json, produced by tests/helpers/replay-extract.mjs from a read-only copy of a real ledger and reduced to
// neutral placeholders) is turned into: a temp runtime root that is a real git repository with revisions (STARCI_KERNEL_REV_ROOT), a product
// repository with a real ledger and a machine registry, optionally a real workflow tree (a git repository shaped like a workflow worktree, registered in
// the machine registry), and a bound Kernel seat. The spec then drives the real code:
//   - `world.cli(verb, args, {as})`   runs `starci kernel <verb>` as a child process, as the bound Kernel or an unbound owner;
//   - `world.engine({controllers})`   runs the real reconciler Engine (real controllers, real ctx, real child verbs) for one or more passes in a fresh
//                                     process (tests/helpers/replay-driver.mjs), so every call is an engine restart;
//   - `world.reviseRuntime(...)`      commits a change in the runtime root: the runtime revision changes here.
// STUBBED seams (the only ones): the Orca binary (terminal and agent launch: tests/helpers/fake-orca.mjs through STARCI_ORCA_COMMAND) and, inside the
// engine driver only, the Critic agent launch (tests/helpers/fake-critic-orca.mjs through the settler's criticSeams). Nothing else is faked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { HOST_RESOURCES_ENV } from '../../scripts/machine/host-resources.mjs';
import { FAKE_ORCA } from './fake-orca.mjs';
import { ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { TEST_REGISTRY_ENV, openMachine } from '../../engine/db/machine.mjs';
import { seedWorkflow } from './ledger-fixture.mjs';
import { bindCurrentKernel } from './bound-kernel.mjs';
import { registerWorkflowWorktree } from '../../scripts/kernel/workflow-worktree.mjs';
import { openDecisionRow } from '../../scripts/machine/decisions.mjs';
import { adoptLaunchTrust } from './launch-trust.mjs';
import { fakeDevinQuotaEnv } from './fake-devin-quota.mjs';
import { ensureHistoryHook } from '../../scripts/guards/hook-install.mjs';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'replay');
export const CLI = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const BRAND_RECORD = ['schema: work/brand@1', 'kind: brand', 'brand:', '  identity:', '    family: starci', '  sources:', '    - path: brand-theme.css', ''].join('\n');
const GIB = 1024 ** 3;
/** The host sample every replayed process reads: 64 GiB of RAM with 40 free, an idle CPU, 500 GB of disk, no worker running machine-wide. */
export const ROOMY_HOST = Object.freeze({ totalRamBytes: 64 * GIB, freeRamBytes: 40 * GIB, freeRamPct: 62.5, freeDiskGb: 500, cpuBusy: 0.1, ops: [], kernels: 0 });
const HOST_TRAP = path.join(ROOT, 'tests', 'helpers', 'replay-host-trap.mjs');
const CHILD_TRAP = path.join(ROOT, 'tests', 'helpers', 'replay-child-trap.mjs');
export const STARCI = path.join(ROOT, 'packages', 'cli', 'bin', 'starci.mjs');
export const DRIVER = path.join(ROOT, 'tests', 'helpers', 'replay-driver.mjs');
/** The seams this harness stubs, named so a spec (and its reader) can state them. */
/** The scratch directories the runtime leaves in the temp root of a replayed child (the temp-leak check of the spec preloads names them). */
const SCRATCH_DIRS = ['starci-kernel-scratch', 'starci-job-scratch', 'starci-settler'];
export const STUBBED = Object.freeze(['orca binary (terminal and agent launch)', 'critic agent launch (engine driver only)']);

const IDENTITY = { GIT_AUTHOR_NAME: 'replay', GIT_AUTHOR_EMAIL: 'replay@example.test', GIT_COMMITTER_NAME: 'replay', GIT_COMMITTER_EMAIL: 'replay@example.test' };
const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
export const parseJson = (text) => { try { return JSON.parse(text); } catch { return null; } };
const lastJson = (text) => parseJson(String(text ?? '').trim()) ?? String(text ?? '').trim().split(/\r?\n/).reverse().map(parseJson).find(Boolean) ?? null;

/** One git call in `cwd`; asserts success and answers the trimmed stdout. */
export function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true, env: { ...process.env, ...IDENTITY } });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}
export const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
function gitInit(dir) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  for (const [key, value] of [['user.email', 'replay@example.test'], ['user.name', 'replay'], ['commit.gpgsign', 'false'], ['core.autocrlf', 'false']]) git(dir, 'config', key, value);
}
export function commit(dir, message) {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '--allow-empty', '-m', message);
  return git(dir, 'rev-parse', 'HEAD');
}

/** The fixture `name` of tests/fixtures/replay. */
export const loadFixture = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));

/** The neutral path an opaque fixture token (`d1.sds`) stands for in the work tree: dots are path separators under `.starciwork/features`. */
export const ownedPathOf = (token) => `.starciwork/features/${String(token).split('.').join('/')}`;

/**
 * Files of the runtime root that make the Kernel's read plan: `count` neutral files of about `pathBytes` characters of path, in a directory the brief of an op cites (contractFilesOf): the read
 * plan of a Kernel no longer holds the verb contracts it cannot run, so the plan grows with the legs it names.
 */
function planFiles({ count, pathBytes = 40, from = 0 }) {
  const dir = 'modules/schemas';
  const pad = Math.max(0, Number(pathBytes) - dir.length - 12);
  return Array.from({ length: Number(count) }, (_, i) => [`${dir}/v${String(from + i).padStart(3, '0')}${'x'.repeat(pad)}.yaml`, `verb: replay-${from + i}\n`]);
}

const SEAT_CONTRACT = 'modules/cli/commands/kernel/status.yaml';
const KERNEL_FILES = { 'modules/kernel/kernel-prompt.md': 'Kernel prompt\n', 'modules/kernel/driver-loop.yaml': 'tick: survey\n', 'modules/kernel/api.yaml': 'schema: replay\n',
  'modules/kernel/owner-rulings.yaml': 'rulings: []\n', 'modules/kernel/verdict-contract.yaml': 'verdict: pass\n', 'modules/ops/_common.yaml': 'common: replay\n', 'scripts/kernel/op-prompt.mjs': 'export {};\n' };

/** The runtime root: a real git repository holding the files a Kernel's read plan names, at revision 1. Answers {runtime, revs: [sha]}. */
function runtimeRoot(dir, fixture) {
  gitInit(dir);
  for (const [rel, text] of Object.entries(KERNEL_FILES)) write(dir, rel, text);
  // The table that classifies a changed path per role is part of the runtime tree the revision notice reads; the tree under test carries it.
  const scope = path.join(ROOT, 'modules', 'kernel', 'revision-scope.yaml');
  if (fs.existsSync(scope)) write(dir, 'modules/kernel/revision-scope.yaml', fs.readFileSync(scope, 'utf8'));
  const ops = new Set([...(fixture.ops ?? ['review.verify']), ...(fixture.jobs ?? []).map((job) => job.op), ...(fixture.plan?.legs ?? []).map((leg) => leg.op)]);
  const neutral = [];
  // The read plan's size is the fixture's: `readPlan.total` files in all (the fixed Kernel files and the op files count), the rest neutral verb files.
  const fixed = Object.keys(KERNEL_FILES).length + ops.size;
  const plan = fixture.runtime?.readPlan ?? { total: fixed + 3 };
  for (const [rel, text] of planFiles({ count: Math.max(0, plan.total - fixed - 1), pathBytes: plan.pathBytes })) { write(dir, rel, text); neutral.push(rel); }
  // the one verb contract a Kernel seat reads that the revision under test touches (a revision of the Kernel's contracts is what makes its attestation stale)
  write(dir, SEAT_CONTRACT, 'verb: status\n');
  // the first op's brief cites the neutral files, so the Kernel's read plan for that op names every one
  [...ops].forEach((op, index) => write(dir, `modules/ops/ops/${op}.yaml`, `id: ${op}\n${index === 0 ? neutral.map((rel) => `${rel}\n`).join('') : ''}`));
  return { runtime: dir, revs: [commit(dir, 'revision 1')], plan, fixed, neutral, firstOp: [...ops][0] };
}

/** The neutral sentence that makes the runtime's cause matcher (progress-rca causesOf) read a report as `cause`; the extractor verified the live report gave that cause. */
const CAUSE_PHRASES = { 'grant-too-narrow': 'the fix needs files outside the owned paths', 'critic-hold': 'CRITIC_UNAVAILABLE: the independent Critic (decision-critic, exit 3) did not start - worker-start, turn start unobserved' };

/** A declared check of a fixture report: the runtime's own read-only validation of the work records, which the settler re-runs in the tree (a stand-in for the op's declared check). */
const checkOf = (check) => ({ name: check.name, command: 'starci runtime validate .starciwork --json', exitCode: 0 });

/** Rows of the fixture that `seedWorkflow` does not take: reports, contracts, decisions. Everything goes through the real writers where one exists. */
function seedExtras(ledger, wf, fixture, at, admit) {
  for (const job of fixture.jobs ?? []) {
    const attempt = ledger.db.prepare('SELECT attempt_id, dispatch_id FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(job.id);
    if (!attempt) continue;
    if (job.provider) ledger.db.prepare('UPDATE op_attempts SET provider=? WHERE job_id=?').run(job.provider, job.id);
    if (!job.admitted) ledger.db.prepare("INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,created_at) VALUES(?,?,?,'replay contract',?)").run(attempt.attempt_id, wf, job.id, at(job.at?.created ?? -600_000));
    const proofs = job.admitted && admit ? admit(ledger, job) : [];
    if (job.report) {
      // An admitted job was admitted and read just now: its report is filed after them (the READ digest must precede the report).
      const filedAt = job.admitted ? Date.now() + 1 : at(job.report.filedAt ?? job.at?.updated ?? -120_000);
      ledger.db.prepare('INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
        .run(wf, attempt.attempt_id, attempt.dispatch_id, job.id, job.report.outcome, JSON.stringify({ outcome: job.report.outcome, summary: 'replay', files: [...(job.report.files ?? []).map((record) => `${ownedPathOf(record)}/index.yaml`), ...proofs], ...(job.report.blocker ? { blocker: { ...job.report.blocker, ...(job.report.cause ? { detail: CAUSE_PHRASES[job.report.cause] } : {}) } } : {}), ...(job.report.checks ? { checks: job.report.checks.map(checkOf) } : {}) }),
          job.report.consumed === false ? null : filedAt + 1, filedAt);
      for (const check of job.report.checks ?? []) ledger.write.recordCheckRun({ attemptId: attempt.attempt_id, name: check.name, phase: 'verify', runner: 'op', status: checkOf(check).exitCode === 0 ? 'pass' : 'fail', declaredExitCode: checkOf(check).exitCode, exitCode: checkOf(check).exitCode, command: checkOf(check).command });
    }
  }
}

/** The job rows of the fixture in the shape `seedWorkflow` takes. */
function jobRows(fixture, at) {
  return (fixture.jobs ?? []).map((job) => ({ jobId: job.id, unitId: job.unit ?? job.id, opId: job.op, status: job.status, tryNo: job.tryNo, retryOf: job.retryOf,
    createdAt: at(job.at?.created ?? -3_600_000), dispatchedAt: at(job.at?.dispatched ?? (job.at?.created ?? -3_600_000) + 1000), updatedAt: at(job.at?.updated ?? -600_000),
    ...(job.result ? { result: job.result } : {}),
    payload: { opId: job.op, records: [], owned_paths: (job.owned ?? []).map(ownedPathOf), ...(job.params ? { params: job.params } : {}), ...(job.after ? { after: job.after } : {}),
      ...(job.routed ? { routed: job.routed } : {}), ...(job.extra ?? {}) } }));
}

/** A payload with every `$rev:N` string replaced by the Nth revision of the runtime root (1-based). */
function revisionTokens(value, revs) {
  return JSON.parse(JSON.stringify(value), (key, item) => { const m = typeof item === 'string' ? /^\$rev:(\d+)$/.exec(item) : null; return m ? revs[Number(m[1]) - 1] : item; });
}

/**
 * The aftermath of a Kernel settle-fail whose branch rewind failed: the prepared decision of the attempt (aimed at the base the registry fell back to, behind the settled
 * checkpoints) stays in the journal and the index of the tree is half reset (the records staged as deleted).
 */
function seedPrepared(ledger, world) {
  const { tree, wf, fixture } = world;
  const job = fixture.jobs[0];
  const attempt = ledger.db.prepare('SELECT attempt_id, dispatch_id FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(job.id);
  const receipt = { workflowId: wf, opId: job.id, attemptId: attempt.attempt_id, dispatchId: attempt.dispatch_id, path: tree.dir, branch: tree.branch, before: tree.git('rev-parse', 'HEAD'),
    resetTo: fixture.tree.prepared.resetTo === 'baseline' ? tree.baseline : tree.checkpoints.at(-1), files: tree.records, settlement: { verdict: fixture.tree.prepared.verdict, job: { status: 'reported' } } };
  ledger.transaction(() => ledger.appendEvent({ workflowId: wf, entityType: 'job', entityId: job.id, attemptId: attempt.attempt_id, kind: 'workflow-op-preserved-prepared', payload: receipt }));
  if (fixture.tree.prepared.halfApplied) tree.git('rm', '-q', '--cached', '--', ...tree.records);
}

/** The first work graph version: nodes with neutral owned-path tokens, every node gray (not yet run). */
function seedWorkGraph(ledger, wf, graph, createdAt) {
  const nodes = graph.nodes.map((node) => ({ id: node.id, domain: node.domain, slice: node.slice ?? node.id, kind: node.kind ?? 'ui', ownedPaths: (node.owned ?? []).map(ownedPathOf) }));
  const body = { schema: 'starci/work-graph@1', domains: [...new Set(nodes.map((node) => node.domain))].map((id) => ({ id })), nodes, edges: [] };
  ledger.db.prepare('INSERT INTO work_graph_versions(workflow_id,version,event,graph_json,diff_json,colors_json,reason,author_op,digest,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(wf, 0, 'draw', JSON.stringify(body), '{}', JSON.stringify(Object.fromEntries(nodes.map((node) => [node.id, 'gray']))), 'replay', 'interface.draw', 'replay-graph', createdAt);
}

/** Seeds the product ledger from the fixture and binds the Kernel seat. Returns nothing; the ledger is closed. */
function seedLedger(ledgerFile, fixture, at, revs, bind, admit) {
  const ledger = openLedger({ file: ledgerFile });
  try {
    const wf = fixture.workflow.id;
    const goal = { revision: fixture.workflow.goalRevision ?? 0, identity: 'goal-1', markdown: '# goal', json: fixture.plan ? { derivedPlan: fixture.plan } : {} };
    const events = (fixture.events ?? []).map((event) => ({ kind: event.kind, entityType: event.entityType ?? (event.entity === wf ? 'workflow' : 'job'), entityId: event.entity ?? wf,
      created_at: at(event.at ?? -60_000), payload: revisionTokens(event.payload ?? {}, revs) }));
    seedWorkflow(ledger, { id: wf, state: { phase: fixture.workflow.phase ?? 'running', job: 'replay' }, goalIdentity: 'goal-1', goal, jobs: jobRows(fixture, at), events });
    seedExtras(ledger, wf, fixture, at, admit);
    // The owner approved the goal (a Kernel start is refused without it).
    ledger.db.prepare("UPDATE goals SET approved_by='owner' WHERE workflow_id=?").run(wf);
    for (const di of fixture.decisions ?? []) openDecisionRow(ledger, { workflowId: wf, kind: di.kind, decider: di.decider ?? 'kernel', entity: di.entity, summary: di.summary ?? `${di.kind} replay`, by: di.by ?? 'reconciler/job', ...(di.key ? { idempotencyKey: di.key } : {}) }, { now: at(di.at ?? -60_000) });
    if (fixture.workGraph) seedWorkGraph(ledger, wf, fixture.workGraph, at(-3_600_000));
    if (bind) bind(ledger, wf);
  } finally { ledger.close(); }
}

/**
 * Builds the world of `fixture` and registers its cleanup on `t`. Options: `tree` (a real workflow tree: a git repository registered as the workflow worktree)
 * and `seed(ledger, ctx)` for rows a case needs beyond the fixture vocabulary (called on an open ledger).
 */
export function replayWorld(t, fixture, { tree = false, seed = null, bindKernel = true, admit = null, launch = false, linkedTree = false } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-replay-')));
  t.after(() => { rm(base); for (const name of SCRATCH_DIRS) rm(path.join(os.tmpdir(), name)); });
  const repo = path.join(base, 'product');
  gitInit(repo);
  write(repo, '.gitignore', '.starciwork/\n');
  commit(repo, 'init');
  const { runtime, revs, plan: readPlan, fixed, neutral, firstOp } = runtimeRoot(path.join(base, 'runtime'), fixture);
  const stub = path.join(base, 'fake-orca.mjs');
  fs.writeFileSync(stub, FAKE_ORCA);
  fs.mkdirSync(path.join(base, 'memo'), { recursive: true });
  const machineFile = path.join(base, 'machine.sqlite');
  const env = { ...process.env, [TEST_REGISTRY_ENV]: machineFile, STARCI_LOCAL_ROOT: path.join(base, 'local'), STARCI_PROJECTS_ROOT: path.join(base, 'projects'),
    STARCI_RUNTIME: ROOT,
    STARCI_ARTIFACT_ROOT: path.join(base, 'artifacts'), STARCI_KERNEL_REV_ROOT: runtime, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: path.join(base, 'orca.jsonl'), STARCI_FAKE_ORCA_STATE: path.join(base, 'orca-state.json'), STARCI_GIT_MEMO_DIR: path.join(base, 'memo'),
    STARCI_AUTOPILOT: 'off', NODE_NO_WARNINGS: '1',
    // The host the runtime reads is injected, never the machine's: a roomy idle host (the dispatch throttle, the disk and RAM floors and the worker census read this sample), and a trap
    // preload in every process that logs a read of the real host (os.freemem, os.cpus, ... ) so a spec can prove none happened.
    [HOST_RESOURCES_ENV]: JSON.stringify(ROOMY_HOST), STARCI_REPLAY_HOST_READS: path.join(base, 'host-reads.jsonl'), STARCI_REPLAY_CHILDREN: path.join(base, 'children.jsonl'),
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(HOST_TRAP).href} --import=${pathToFileURL(CHILD_TRAP).href}`.trim() };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB', 'STARCI_STATUS_MEMO', 'STARCI_ACTOR']) delete env[key];
  const saved = { ...process.env };
  Object.assign(process.env, { [TEST_REGISTRY_ENV]: env[TEST_REGISTRY_ENV], STARCI_LOCAL_ROOT: env.STARCI_LOCAL_ROOT, STARCI_PROJECTS_ROOT: env.STARCI_PROJECTS_ROOT, STARCI_KERNEL_REV_ROOT: runtime });
  t.after(() => { for (const key of ['STARCI_LOCAL_ROOT', 'STARCI_PROJECTS_ROOT', 'STARCI_KERNEL_REV_ROOT', TEST_REGISTRY_ENV]) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });
  openMachine({ file: machineFile }).close();
  const now = Date.now();
  const at = (offset) => now + Number(offset);
  const ledgerFile = ledgerFileFor(repo, { env });
  const wf = fixture.workflow.id;
  let kernelEnv = {};
  const world = { base, repo, runtime, env, machineFile, ledgerFile, wf, revs, now, at, tree: null, fixture, stubbed: STUBBED };
  if (tree) {
    const dir = path.join(base, 'tree');
    const branch = `wf-${wf}`;
    if (linkedTree) {
      // The workflow worktree of a real host is a LINKED worktree of the repository's main checkout (the primary checkout is the owner's: a Kernel start never installs in it).
      const main = path.join(base, 'tree-main');
      gitInit(main);
      write(main, '.gitignore', 'node_modules/\n');
      // `tree.scaffold(dir)`: the app files a started workflow's tree holds from its baseline (committed before the branch is registered, so they are no foreign commit).
      if (typeof tree?.scaffold === 'function') tree.scaffold(main);
      commit(main, 'chore(app): establish canonical hfs app baseline');
      git(main, 'worktree', 'add', '-q', '-b', branch, dir);
    } else {
      gitInit(dir);
      write(dir, '.gitignore', 'node_modules/\n');
      if (typeof tree?.scaffold === 'function') tree.scaffold(dir);
      commit(dir, 'chore(app): establish canonical hfs app baseline');
      git(dir, 'checkout', '-q', '-b', branch);
    }
    registerWorkflowWorktree({ env }, { workflowId: wf, orcaWorktreeId: `replay::${wf}`, path: dir, branch });
    const baseline = git(dir, 'rev-parse', 'HEAD');
    // The settled ops before this one: a chain of `checkpoint <workflow>: ...` commits on the branch (the registry record carries no pointer to them).
    const checkpoints = Array.from({ length: fixture.tree?.checkpoints ?? 0 }, (_, i) => { write(dir, `settled-${i + 1}.txt`, `${i + 1}\n`); return commit(dir, `checkpoint ${wf}: op-step-${i + 1}`); });
    // The records are the op's work in its tree: uncommitted for the settle to checkpoint, or (`preserved`) already committed by the worktree's collector.
    const records = (fixture.tree?.records ?? []).map((record) => {
      const parts = String(record).split('.');
      write(dir, `${ownedPathOf(record)}/index.yaml`, `id: ${parts[1]}.${parts[0]}.${parts.slice(2).join('.')}\nkind: ${parts[1]}\n`);
      return `${ownedPathOf(record)}/index.yaml`;
    });
    // A finished brand leg wrote the brand record into the workflow tree; the repository's main checkout has none until the workflow finishes.
    if (fixture.tree?.brand) { write(dir, '.starciwork/brand/index.yaml', BRAND_RECORD); write(dir, 'brand-theme.css', ':root { --brand: #000; }\n'); }
    if (fixture.tree?.preserved) commit(dir, `preserve ${wf}/gc: uncommitted work of its worktree`);
    // The history hook of the revision under test guards the branch, as the host's does.
    ensureHistoryHook(dir);
    world.tree = { dir, branch, baseline, checkpoints, records, git: (...args) => git(dir, ...args), write: (rel, text) => write(dir, rel, text), commit: (message) => commit(dir, message) };
  }
  // `launch`: the owner's launch trust is adopted for the world's roots and the Devin quota seat answers from loopback (a dispatch then reaches the Orca stub's worker-start).
  if (launch) Object.assign(env, fakeDevinQuotaEnv(t, path.join(base, 'appdata')), adoptLaunchTrust(base, { roots: [repo, world.tree?.dir, linkedTree ? path.join(base, 'tree-main') : null, base].filter(Boolean), ref: 'replay world adoption' }), { STARCI_SLEEP_SCALE: '0.02', STARCI_FAKE_ORCA_MODE: 'healthy' });
  seedLedger(ledgerFile, fixture, at, revs, bindKernel ? (ledger, id) => { kernelEnv = bindCurrentKernel(ledger, id); } : null, admit ? (ledger, job) => admit(world, ledger, job) : null);
  if (fixture.tree?.prepared) { const ledger = openLedger({ file: ledgerFile }); try { seedPrepared(ledger, world); } finally { ledger.close(); } }
  if (seed) { const ledger = openLedger({ file: ledgerFile }); try { seed(ledger, world); } finally { ledger.close(); } }

  /** The ledger opened for `fn`, closed after (a child process may hold the file between calls: sqlite WAL arbitrates). */
  world.ledger = (fn) => { const ledger = openLedger({ file: ledgerFile }); try { return fn(ledger); } finally { ledger.close(); } };
  /** `starci kernel <verb> <args> --repo --json` as a child: {status, json, stderr, stdout}. `as`: 'kernel' (the bound seat) or 'owner'. */
  world.cli = (verb, args = [], { as = 'kernel', extraEnv = {}, timeout = 180_000 } = {}) => {
    const r = spawnSync(process.execPath, [CLI, verb, ...args.map(String), '--repo', repo, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout,
      env: { ...env, ...(as === 'kernel' ? kernelEnv : {}), ...extraEnv } });
    return { status: r.status, json: lastJson(r.stdout) ?? lastJson(r.stderr), stdout: r.stdout, stderr: r.stderr };
  };
  /**
   * The Kernel's READ attestation for `ops`, through the real verbs: `kernel-ack-rev --plan` writes the manifest, `kernel-ack-rev --rev --read-manifest` attests it.
   * Answers the ack's result ({status, json}); the admission of a new leg reads this event back.
   */
  world.ack = (ops = []) => {
    const flags = ops.flatMap((op) => ['--op', op]);
    const plan = world.cli('kernel-ack-rev', ['--workflow', wf, '--plan', ...flags]);
    assert.equal(plan.status, 0, `ack plan: ${plan.stderr || plan.stdout}`);
    const file = path.join(base, `read-plan-${revs.length}.json`);
    fs.writeFileSync(file, JSON.stringify(plan.json.readManifest));
    return world.cli('kernel-ack-rev', ['--workflow', wf, '--rev', plan.json.readManifest.rev, '--read-manifest', file, ...flags]);
  };
  /** `starci <args> --json` (the whole CLI, as the Supervisor or the owner runs it): {status, json, stdout, stderr}. */
  world.starci = (args = [], { extraEnv = {}, timeout = 180_000 } = {}) => {
    const r = spawnSync(process.execPath, [STARCI, ...args.map(String), '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout, env: { ...env, ...extraEnv } });
    return { status: r.status, json: lastJson(r.stdout) ?? lastJson(r.stderr), stdout: r.stdout, stderr: r.stderr };
  };
  /** The reads of the real host the trap logged in any process of this world: [{read, pid, frame}]. */
  /** The detached children the processes of this world started and that are still alive: [{pid, by, command, argv}]. A replay pass ends when its work ends; one of these races the spec. */
  world.leakedChildren = () => {
    const file = env.STARCI_REPLAY_CHILDREN;
    if (!fs.existsSync(file)) return [];
    const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } };
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)).filter((row) => alive(row.pid));
  };
  t.after(() => { for (const row of world.leakedChildren()) { try { spawnSync('taskkill', ['/PID', String(row.pid), '/T', '/F'], { windowsHide: true }); } catch { /* gone */ } try { process.kill(row.pid); } catch { /* gone */ } } });
  world.hostReads = () => { const file = env.STARCI_REPLAY_HOST_READS; return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : []; };
  /** The state the Orca stub kept (runs, run-uses, workers started): its own file, written by every stub call. */
  world.orca = () => { try { return JSON.parse(fs.readFileSync(env.STARCI_FAKE_ORCA_STATE, 'utf8')); } catch { return {}; } };
  world.status = () => { const r = world.cli('status', ['--workflow', wf]); assert.equal(r.status, 0, `status: ${r.stderr || r.stdout}`); return r.json; };
  /** The runtime revision whose read plan has grown to the fixture's `grownTotal` files (the revision that outgrew the inline event bound). */
  world.growReadPlan = () => {
    const grown = planFiles({ count: readPlan.grownTotal - readPlan.total, pathBytes: readPlan.pathBytes, from: readPlan.total - fixed });
    neutral.push(...grown.map(([rel]) => rel));
    return world.reviseRuntime({ ...Object.fromEntries(grown), [SEAT_CONTRACT]: 'verb: status\nrevision: 2\n', [`modules/ops/ops/${firstOp}.yaml`]: `id: ${firstOp}\n${neutral.map((rel) => `${rel}\n`).join('')}` }, 'revision with a larger read plan');
  };
  /** The runtime revision changes here: `files` ({rel: text}) are written and committed in the runtime root. Answers the new revision. */
  world.reviseRuntime = (files = {}, message = `revision ${revs.length + 1}`) => {
    for (const [rel, text] of Object.entries(files)) write(runtime, rel, text);
    if (!Object.keys(files).length) write(runtime, 'docs/notes.md', `${message}\n`);
    revs.push(commit(runtime, message));
    return revs.at(-1);
  };
  /**
   * The real reconciler Engine over this world for `passes` passes in a fresh process (an engine restart per call): {ok, passes: [{controllers: [...]}], ...}.
   * `controllers` names the controllers run active (default job, workflow); `critic` configures the stubbed Critic launch ({mode, verdict} for fake-critic-orca); `unbound` runs the engine as the live one runs, with no Kernel identity in its environment (the default keeps the bound Kernel's).
   */
  world.engine = ({ controllers = ['job', 'workflow'], passes = 1, critic = null, detachedPush = false, expectLeaked = false, timeout = 300_000, unbound = false } = {}) => {
    const spec = { repo, ledgerFile, controllers, passes, critic, detachedPush, ledgerId: path.basename(repo), env: { STARCI_ORCA_COMMAND: env.STARCI_ORCA_COMMAND } };
    const r = spawnSync(process.execPath, [DRIVER, JSON.stringify(spec)], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout, env: { ...env, ...(unbound ? {} : kernelEnv) } });
    const out = lastJson(r.stdout);
    assert.ok(out, `engine driver gave no JSON (exit ${r.status}): ${String(r.stderr).slice(-1500)}`);
    if (!expectLeaked) assert.deepEqual(world.leakedChildren(), [], 'a replay pass left a detached child alive after it returned: it would race whatever the spec does next (engine option detachedPush asks for the live shape)');
    return out;
  };
  return world;
}
