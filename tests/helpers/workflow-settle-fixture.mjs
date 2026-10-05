// Private Git fixtures: native settle uses real ledger/registry; milestone policy uses the existing ownership seam.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { registerWorkflowWorktree } from '../../scripts/kernel/workflow-worktree.mjs';
import { workflowWorktreeOf } from '../../scripts/machine/workflow-tree.mjs';
import { seedWorkflow } from './ledger-fixture.mjs';
import { admitPacket, captureDispatchInputs, selectDispatchContract } from '../../scripts/kernel/dispatch-admission.mjs';
import { observationContextOf, observeCheck, stageObservation } from '../../scripts/kernel/mechanism-observation.mjs';
import { classifyCheck, rerunCheck } from '../../scripts/kernel/settle/job-settle.mjs';
import { recordCheck } from '../../scripts/machine/evidence-store.mjs';
import { proofEntriesOf } from '../../scripts/kernel/mechanism-proofs.mjs';
import { gateInputSnapshot } from '../../scripts/gates/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };

export function settleFixture(t, { baseText = 'base\n' } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-wf-settle-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(base, 'app'), tree = path.join(base, 'workflow');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  for (const [key, value] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', key, value);
  write(repo, '.gitignore', '.starciwork/\n');
  write(repo, 'docs/base.md', baseText);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  const workflowId = 'wf-settle-caller', branch = `wf-${workflowId}`;
  git(repo, 'worktree', 'add', '-q', '-b', branch, tree, 'main');
  const env = { ...process.env, [TEST_REGISTRY_ENV]: path.join(base, 'machine.sqlite'), LOCALAPPDATA: path.join(base, 'localappdata'),
    STARCI_PROJECTS_ROOT: path.join(base, 'projects'), STARCI_ARTIFACT_ROOT: path.join(base, 'artifacts'),
    STARCI_LOCAL_ROOT: path.join(base, 'local'), STARCI_OWNER_ROOT: path.join(base, 'owner'), STARCI_LANES_ROOT: path.join(base, 'lanes') };
  registerWorkflowWorktree({ env }, { workflowId, orcaWorktreeId: 'repo-settle::workflow', path: tree, branch });
  const apiArgs = (args) => [path.join(ROOT, 'scripts', 'kernel', 'cli.mjs'), ...args, ...(args[0] === 'settle' ? ['--sync-tail'] : []), '--repo', repo, '--json'];
  const runApi = (args, extraEnv = {}, preload = null) => spawnSync(process.execPath, [...(preload ? [`--import=${pathToFileURL(preload).href}`] : []), ...apiArgs(args)],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180000, env: { ...env, ...extraEnv } });
  const runConcurrentApi = (args, preload = null) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...(preload ? [`--import=${pathToFileURL(preload).href}`] : []), ...apiArgs(args)], { cwd: ROOT, windowsHide: true, env, timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.setEncoding('utf8').on('data', (part) => { stdout += part; });
    child.stderr.setEncoding('utf8').on('data', (part) => { stderr += part; });
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
  const seed = (job) => {
    const ledger = openLedger({ file: ledgerFileFor(repo, { env }) });
    try {
      const exists = ledger.db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(workflowId) != null;
      seedWorkflow(ledger, { id: workflowId, ...(exists ? {} : { goal: { revision: 1, markdown: '# Settle caller' } }), jobs: [job], leases: [{ resourceKey: `spec:${job.jobId}`, jobId: job.jobId, units: 1 }] });
      const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(job.jobId).attempt_id;
      const opId = job.opId, payload = job.payload ?? {}, selection = selectDispatchContract(ROOT, opId, payload);
      const owned = payload.owned_paths ?? [], packet = { context: { records: payload.records ?? [],
        owned_paths: owned.map((file) => ({ root: tree, path: file })), selected_op: selection.selected,
        workflow_worktree: workflowWorktreeOf({ env }, workflowId) } };
      admitPacket(ROOT, { packet, op: opId, placements: owned.map((file) => ({ base: tree, path: file })), db: ledger.db, workflowId });
      const { inputs, contextPack } = captureDispatchInputs({ skillRoot: ROOT, op: opId, packet, briefDoc: selection.brief,
        params: selection.params, repo, stateDir: path.join(repo, '.starciwork'), workerCwd: tree });
      ledger.write.writeContract({ attemptId, markdown: fs.readFileSync(path.join(ROOT, 'modules/ops/ops', `${opId}.yaml`), 'utf8'),
        context: { worktree: tree, packet, contract: packet.context.contract, inputs, mandatory: contextPack.mandatory } });
      return { ledger, attemptId };
    } catch (error) { ledger.close(); throw error; }
  };
  const read = (fn) => { const ledger = inspectLedger({ file: ledgerFileFor(repo, { env }) }); try { return fn(ledger.db); } finally { ledger.close(); } };
  const capture = (jobId) => ({
    head: git(tree, 'rev-parse', 'HEAD'),
    index: git(tree, 'ls-files', '--stage', '-z'),
    changes: git(tree, 'diff', '--binary', 'HEAD'),
    untracked: git(tree, 'ls-files', '--others', '--exclude-standard').split(/\r?\n/).filter(Boolean).map((file) => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(tree, file))).digest('hex') })),
    checkpoint: workflowWorktreeOf({ env }, workflowId)?.checkpoint ?? null,
    events: read((db) => db.prepare("SELECT seq,kind,payload_json FROM events WHERE workflow_id=? AND kind IN ('workflow-checkpoint-prepared','workflow-checkpoint-applied','workflow-op-preserved-prepared','workflow-op-preserved-applied','workflow-rebase-prepared','workflow-rebase-applied','workflow-checkpoint','workflow-op-preserved','op-settled') ORDER BY seq").all(workflowId)),
    job: read((db) => db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)),
    attempt: read((db) => db.prepare('SELECT verdict,settled_at,settle_json FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId)),
    reports: read((db) => db.prepare('SELECT report_id,consumed_at FROM reports WHERE job_id=? ORDER BY report_id').all(jobId)),
    leases: read((db) => db.prepare('SELECT * FROM leases WHERE job_id=? ORDER BY resource_key').all(jobId)),
    outbox: fs.existsSync(`${env[TEST_REGISTRY_ENV]}.outbox.jsonl`) ? fs.readFileSync(`${env[TEST_REGISTRY_ENV]}.outbox.jsonl`, 'utf8') : null,
  });
  // CHECK outputs and staged blobs stay outside the checkout whose bytes they measure.
  const proofs = (prepared, jobId) => {
    const db = prepared.ledger.db, job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
    const owed = proofEntriesOf(job.op_id).map((row) => row.proof);
    if (!owed.length) return [];
    assert.ok(owed.every((proof) => ['read-knowledge', 'doc-gate'].includes(proof)), 'fixture only owns native documentation proofs');
    const context = observationContextOf(db, job, { repo, skillRoot: ROOT });
    assert.ok(context, 'current fixture admission must require native mechanism observations');
    const filed = JSON.parse(db.prepare('SELECT context_json FROM contracts WHERE attempt_id=?').get(prepared.attemptId).context_json);
    const target = filed.packet.context.gate_binding.targets.find((row) => path.resolve(row.root) === tree);
    const changed = gateInputSnapshot(tree, target.head, [], target.owned).inputs.map((row) => row.path);
    const knowledge = context.readRefs.filter((row) => row.rootKind === 'source' && row.path.startsWith('knowledge/')).map((row) => row.path);
    const commands = [
      ['read-knowledge', ['node', path.join(ROOT, 'scripts/gates/read-digest.mjs'), '--root', tree, ...(changed.length ? ['--touch', ...changed] : []), '--knowledge', ...knowledge]],
      ['doc-gate', ['node', path.join(ROOT, 'scripts/gates/gate.mjs'), '--root', tree, '--scope', 'docs', '--tree', path.join(tree, 'docs')]],
    ];
    const files = [], scratch = path.join(base, 'proofs', jobId);
    fs.mkdirSync(scratch, { recursive: true });
    for (const [name, args] of commands.filter(([name]) => owed.includes(name))) {
      const command = args.map((arg) => JSON.stringify(String(arg).replaceAll('\\', '/'))).join(' ');
      const check = classifyCheck({ command }, { skillRoot: ROOT, mechanical: true });
      assert.equal(check.mechanical, true, command);
      const run = observeCheck(check, context, (cwd) => rerunCheck(check, { repo: cwd, env, timeoutMs: 180000 }));
      assert.deepEqual([run.processStatus, run.processError, run.processSignal, run.native?.stable], [0, null, null, true], `${command}\n${run.stderr}\n${run.stdout}`);
      assert.equal(run.output?.schema, check.schema, 'retain the actual native JSON, never a green checker double');
      const file = path.join(scratch, `${name}.json`);
      fs.writeFileSync(file, `${JSON.stringify(run.output, null, 2)}\n`);
      const previous = process.env.STARCI_ARTIFACT_ROOT;
      try {
        process.env.STARCI_ARTIFACT_ROOT = env.STARCI_ARTIFACT_ROOT;
        const { native, ...staged } = stageObservation(run, [tree]);
        prepared.ledger.transaction(() => recordCheck(db, { attemptId: prepared.attemptId, name: `native-${name}`, phase: 'verify', runner: 'kernel',
          command, ...staged, summary: { native } }));
      } finally { if (previous === undefined) delete process.env.STARCI_ARTIFACT_ROOT; else process.env.STARCI_ARTIFACT_ROOT = previous; }
      files.push(file);
    }
    return files;
  };
  const pending = new Map();
  const prepare = ({ jobId, opId = 'docs.author', outcome = 'done', checkExit = 0, report = true, ownedRoot = 'docs', payload = {}, arrange = () => {}, deferProofs = false }) => {
    const prepared = seed({ jobId, opId, status: 'running', dispatchId: `ctx-${jobId}`, payload: { opId, owned_paths: [`${ownedRoot}/`], ...payload } });
    const finish = (current) => {
      const files = report && outcome === 'done' && checkExit === 0 ? proofs(current, jobId) : [];
      if (report) current.ledger.write.fileReport({ attemptId: current.attemptId, outcome, report: { schema: 'starci/op-report@1', outcome, summary: 'checkpoint fixture', files: [`${ownedRoot}/change.md`, ...files], head: git(tree, 'rev-parse', 'HEAD'),
        ...(outcome === 'blocked' ? { blocker: { kind: 'environment', detail: 'private fixture unavailable' } } : {}) } });
      if (checkExit !== null) current.ledger.write.recordCheckRun({ attemptId: current.attemptId, name: 'unit', phase: 'verify', runner: 'kernel', status: checkExit === 0 ? 'pass' : 'fail', exitCode: checkExit });
    };
    try {
      write(tree, `${ownedRoot}/change.md`, `owned change of ${jobId}\n`);
      arrange();
      if (deferProofs) pending.set(jobId, () => {
        const ledger = openLedger({ file: ledgerFileFor(repo, { env }) });
        try { finish({ ledger, attemptId: prepared.attemptId }); } finally { ledger.close(); }
      });
      else finish(prepared);
    } finally { prepared.ledger.close(); }
    return prepared.attemptId;
  };
  const complete = (jobId) => { assert.ok(pending.has(jobId), 'deferred private CHECK/REPORT exists'); pending.get(jobId)(); pending.delete(jobId); };
  return { base, repo, tree, env, workflowId, runApi, runConcurrentApi, seed, read, capture, prepare, proofs, complete };
}

export function apiResult(result) {
  for (const output of [result.stdout, result.stderr]) {
    try { const value = JSON.parse(String(output ?? '').trim()); if (typeof value?.ok === 'boolean') return value; } catch { /* try JSON lines after a child warning */ }
  }
  for (const line of `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().split(/\r?\n/).reverse()) {
    try { const value = JSON.parse(line); if (typeof value?.ok === 'boolean') return value; } catch { /* non-JSON child warning */ }
  }
  assert.fail(`no API receipt: ${result.stdout}\n${result.stderr}`);
}

export function acceptedEventFault(fx, kind = 'workflow-checkpoint') {
  const preload = path.join(fx.base, `interrupt-${kind}.mjs`);
  fs.writeFileSync(preload, `import { DatabaseSync } from 'node:sqlite';
const prepare = DatabaseSync.prototype.prepare;
DatabaseSync.prototype.prepare = function (sql, ...rest) {
  const statement = prepare.call(this, sql, ...rest);
  const columns = /^INSERT INTO events\\s*\\(([^)]+)\\)/i.exec(sql)?.[1]?.split(',').map((value) => value.trim());
  if (!columns) return statement;
  const run = statement.run.bind(statement), kind = columns.indexOf('kind');
  statement.run = (...args) => {
    if (args[kind] === ${JSON.stringify(kind)}) throw Object.assign(new Error('accepted event failed in private fixture'), { code: 'injected-accepted-event-failure' });
    return run(...args);
  };
  return statement;
};
`);
  return preload;
}

export async function awaitFile(file) {
  const deadline = Date.now() + 30000;
  while (!fs.existsSync(file)) {
    assert.ok(Date.now() < deadline, `private child did not reach barrier ${file}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}


export function emptyReceiptBarrier(fx) {
  const seen = path.join(fx.base, 'receipt-read.json'), release = path.join(fx.base, 'release-waiter');
  const preload = path.join(fx.base, 'pause-first-receipt-read.mjs');
  fs.writeFileSync(preload, `import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const prepare = DatabaseSync.prototype.prepare;
let paused = false;
DatabaseSync.prototype.prepare = function (sql, ...rest) {
  const statement = prepare.call(this, sql, ...rest);
  if (!/^SELECT\\s+payload_json(?:\\s*,\\s*payload_sha)?\\s+FROM events/i.test(sql) || !sql.includes("'workflow-checkpoint-prepared'") || !sql.includes("'workflow-op-preserved-prepared'")) return statement;
  const get = statement.get.bind(statement);
  statement.get = (...args) => {
    const row = get(...args);
    if (!paused) {
      paused = true;
      fs.writeFileSync(${JSON.stringify(seen)}, JSON.stringify(row ?? null));
      const deadline = Date.now() + 60000, sleep = new Int32Array(new SharedArrayBuffer(4));
      while (!fs.existsSync(${JSON.stringify(release)})) {
        if (Date.now() > deadline) throw Object.assign(new Error('private waiter timed out'), { code: 'injected-barrier-timeout' });
        Atomics.wait(sleep, 0, 0, 25);
      }
    }
    return row;
  };
  return statement;
};
`);
  return { preload, seen, release };
}

export function milestoneRegistryFault(fx) {
  const preload = path.join(fx.base, 'interrupt-milestone-registry.mjs'), writes = path.join(fx.base, 'checkpoint-writes.json');
  fs.writeFileSync(preload, `import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const prepare = DatabaseSync.prototype.prepare, checkpoints = [];
DatabaseSync.prototype.prepare = function (sql, ...rest) {
  const statement = prepare.call(this, sql, ...rest);
  if (!sql.startsWith('UPDATE worktrees SET checkpoint_sha=')) return statement;
  const run = statement.run.bind(statement);
  statement.run = (...args) => {
    checkpoints.push(args[0]);
    fs.writeFileSync(${JSON.stringify(writes)}, JSON.stringify(checkpoints));
    if (checkpoints.length === 2) return { changes: 0, lastInsertRowid: 0 };
    return run(...args);
  };
  return statement;
};
`);
  return { preload, writes };
}

export const MILESTONE_ID = 'wf-nivo-milestone-k1';
export const MILESTONE_TEXT = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', ''].join('\n');
const commit = (cwd, rel, text, msg) => { write(cwd, rel, text); git(cwd, 'add', '-A'); git(cwd, 'commit', '-q', '-m', msg); return git(cwd, 'rev-parse', 'HEAD'); };

export function milestoneFixture(t, { live = [], behindLimit = 3 } = {}) {
  const WF = MILESTONE_ID, BRANCH = `wf-${WF}`, A = MILESTONE_TEXT;
  const OCCUPYING = ['leased', 'running', 'answering', 'reported', 'deciding', 'effect_unknown'];
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-wf-ms-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(base, 'app'), dir = path.join(base, 'wf');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', k, v);
  write(repo, 'be/a.ts', A);
  write(repo, 'fe/b.ts', 'export const b = 1;\n');
  write(repo, 'docs/readme.md', 'app\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  git(repo, 'worktree', 'add', '-q', '-b', BRANCH, dir, 'main');
  const registry = new Map([[WF, { workflowId: WF, orcaWorktreeId: 'orca-wt-1', path: dir, branch: BRANCH, checkpoint: null }]]);
  const escalations = [];
  const jobs = live.map((id) => ({ job_id: id, workflow_id: WF, status: 'running' }));
  const db = { prepare: () => ({ get: () => null, all: (workflowId, exceptId, ...statuses) => jobs.filter((j) => j.workflow_id === workflowId && j.job_id !== exceptId && statuses.includes(j.status)) }) };
  const worktree = {
    workflowWorktreeOf: (_ctx, id) => (registry.has(id) ? { ...registry.get(id) } : null),
    workflowWorktreeAt: () => null,
    setCheckpoint: (_ctx, id, sha) => { registry.get(id).checkpoint = sha; return true; },
    TERMINAL_JOB_STATUSES: OCCUPYING,
  };
  const env = { ...process.env, [TEST_REGISTRY_ENV]: path.join(base, 'machine.sqlite'), STARCI_LANES_ROOT: path.join(base, 'lanes') };
  const ctx = { env, worktree, db, behindLimit, escalate: (e) => { escalations.push(e); return { ok: true, decisionId: `di-${escalations.length}` }; } };
  // The workflow's first checkpoint: a be change on the branch.
  const cp = commit(dir, 'be/a.ts', A.replace('l1', 'wf1'), 'checkpoint be');
  registry.get(WF).checkpoint = cp;
  return { repo, dir, ctx, registry, escalations, cp };
}
