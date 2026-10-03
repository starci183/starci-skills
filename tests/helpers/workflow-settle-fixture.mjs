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
import { writeGreenProofs } from './sonar-scan.mjs';

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
      ledger.write.writeContract({ attemptId, markdown: '# contract', context: { worktree: tree } });
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
  const prepare = ({ jobId, opId = 'docs.author', outcome = 'done', checkExit = 0, report = true, ownedRoot = 'docs', payload = {} }) => {
    const prepared = seed({ jobId, opId, status: 'running', dispatchId: `ctx-${jobId}`, payload: { opId, owned_paths: [`${ownedRoot}/`], ...payload } });
    try {
      write(tree, `${ownedRoot}/change.md`, `owned change of ${jobId}\n`);
      const files = writeGreenProofs(path.join(tree, ownedRoot, 'proofs')).map((file) => path.relative(tree, file).replace(/\\/g, '/'));
      if (report) prepared.ledger.write.fileReport({ attemptId: prepared.attemptId, outcome, report: { schema: 'starci/op-report@1', outcome, summary: 'checkpoint fixture', files: [`${ownedRoot}/change.md`, ...files], head: git(tree, 'rev-parse', 'HEAD'),
        ...(outcome === 'blocked' ? { blocker: { kind: 'environment', detail: 'private fixture unavailable' } } : {}) } });
      if (checkExit !== null) prepared.ledger.write.recordCheckRun({ attemptId: prepared.attemptId, name: 'unit', phase: 'verify', runner: 'kernel', status: checkExit === 0 ? 'pass' : 'fail', exitCode: checkExit });
    } finally { prepared.ledger.close(); }
    return prepared.attemptId;
  };
  return { base, repo, tree, env, workflowId, runApi, runConcurrentApi, seed, read, capture, prepare };
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
