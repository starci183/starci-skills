// starci kernel dispatch-ready pushes each queued-ready job through a child `starci kernel dispatch --spawn`.
// When that child refuses — a typed dispatch-rejected (rejectDispatch: the launch failed at a named step, the
// job went back to ready with no try spent) or any verb refusal — the push result must carry the child's typed
// refusal {code, reason[, step]}, never a bare 'exit 1'. Live defect: push-cb9067eb89 surfaced only 'exit 1'
// for a failed child dispatch, so the Kernel could not see which step refused it or why.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { openMachine } from '../../engine/db/machine.mjs';
import { seedWorkflow as seedLedgerWorkflow } from '../helpers/ledger-fixture.mjs';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { fakeDevinQuotaEnv } from '../helpers/fake-devin-quota.mjs';
import { registerRepoWorkflowWorktree } from '../helpers/workflow-worktree-row.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const WF = 'wf-push';
const KERNEL = 'kernel-wf-push';
const JOB = 'op-scope.define-cb9067eb89';

const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
};
const worldEnv = (repo) => ({ ...process.env,
  STARCI_PROJECTS_ROOT: path.join(repo, '.starciwork', 'projects'),
  STARCI_TEST_MACHINE_FILE: path.join(repo, '.starciwork', 'machine.sqlite'),
  STARCI_LOCAL_ROOT: path.join(repo, '.starciwork', 'localappdata'),
  STARCI_GUARDS_ROOT: path.join(repo, '.starciwork', 'guards'),
  STARCI_TEMP_ROOT: path.join(repo, '.starciwork', 'tmp') });
const ownerRoot = (t, repo) => {
  const dir = tmp(t, 'starci-owner-');
  const example = path.join(ROOT, 'config.example.yaml');
  fs.copyFileSync(example, path.join(dir, 'config.example.yaml'));
  const config = parseYaml(fs.readFileSync(example, 'utf8'));
  fs.writeFileSync(path.join(dir, 'config.yaml'), stringifyYaml({ ...config,
    launchTrust: { profile: 'automatic', approvedBy: 'owner', approvalRef: 'dispatch-ready fixture', roots: [repo] },
    budgets: { maxOps: null } }));
  return dir;
};
const env = (t, repo, { orcaMode = 'healthy' } = {}) => {
  const dir = tmp(t, 'starci-fake-orca-');
  const stub = path.join(dir, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  fs.writeFileSync(path.join(dir, 'state.json'), '{}');
  const e = { ...worldEnv(repo), STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: path.join(dir, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: path.join(dir, 'state.json'),
    STARCI_FAKE_ORCA_MODE: orcaMode,
    STARCI_OWNER_ROOT: ownerRoot(t, repo), ...fakeDevinQuotaEnv(t, dir) };
  openMachine({ env: e }).close();
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB']) delete e[key];
  return e;
};

// The push-cb9067eb89 shape: a running Kernel, one queued op pinned to claude-agent by kernelModel (the same
// pin dispatch-ready passes through as --model), and a host whose run-create refuses locally.
const seed = (repo) => {
  const e = worldEnv(repo);
  const l = openLedger({ file: ledgerFileFor(repo, { env: e }) });
  try {
    seedLedgerWorkflow(l, { id: WF, state: { phase: 'running', job: 'dispatch-ready refusal' }, goalIdentity: 'pushgoal',
      goal: { revision: 0, identity: 'pushgoal', markdown: '# goal', json: {} },
      jobs: [
        { jobId: KERNEL, kind: 'kernel', status: 'running', workerId: 'fake-kernel-terminal',
          payload: { route: { host: 'orca', agent: 'codex', model: 'gpt-6.1-sol' },
            hierarchy: { schema: 'starci/agent-hierarchy@1', nodeId: `agent:kernel:${WF}`, parentNodeId: `workflow:${WF}`, role: 'kernel' } } },
        { jobId: JOB, unitId: 'push-unit', opId: 'scope.define', status: 'queued',
          payload: { opId: 'scope.define', owned_paths: ['docs/'], kernelModel: 'claude-agent' } },
      ] });
  } finally { l.close(); }
};
const ready = (t, repo, args = []) => {
  const e = env(t, repo, { orcaMode: 'run-create-no-sender' });
  const r = spawnSync(process.execPath, [API, 'dispatch-ready', '--repo', repo, '--workflow', WF, '--foreground', ...args, '--json'],
    { cwd: ROOT, env: e, encoding: 'utf8', windowsHide: true, timeout: 240000 });
  let body = null;
  try { body = JSON.parse(r.stdout); } catch { try { body = JSON.parse(String(r.stderr).trim().split(/\r?\n/).pop()); } catch { body = null; } }
  return { status: r.status, body, stdout: r.stdout, stderr: r.stderr };
};

test('dispatch-ready carries the child dispatch\'s typed refusal (code + reason), not \'exit 1\'', (t) => {
  const repo = tmp(t, 'starci-dr-repo-');
  fs.writeFileSync(path.join(repo, 'README.md'), '# fixture\n');
  fs.mkdirSync(path.join(repo, 'docs'));
  fs.writeFileSync(path.join(repo, 'docs', 'index.md'), '# docs\n');
  git(repo, 'init', '-b', 'main');
  git(repo, 'add', '-A');
  git(repo, '-c', 'user.email=spec@local', '-c', 'user.name=spec', 'commit', '-m', 'baseline');
  seed(repo);
  const e = worldEnv(repo);
  registerRepoWorkflowWorktree({ repo, workflowId: WF, env: e });

  const r = ready(t, repo);
  assert.equal(r.status, 0, `dispatch-ready itself succeeded: ${r.stderr || r.stdout}`);
  assert.equal(r.body?.ok, true, r.stdout + r.stderr);
  const row = (r.body.results ?? []).find((item) => item.jobId === JOB);
  assert.ok(row, `the push reports the job: ${JSON.stringify(r.body.results)}`);
  assert.equal(row.dispatched, false, 'run-create-no-sender refuses before any worker exists');
  assert.equal(row.refusal?.code, 'dispatch-rejected', `the child's typed refusal reaches the push result: ${JSON.stringify(row)}`);
  assert.match(row.refusal?.reason ?? '', /run-create|no_active_sender_terminal/i, 'the refusal names why the launch refused');
  assert.equal(row.refusal?.step, 'run-create');
  assert.notEqual(row.error, 'exit 1');
  const job = inspectLedger({ file: ledgerFileFor(repo, { env: e }) });
  try {
    assert.equal(job.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(JOB)?.status, 'ready',
      'a no-effect rejection requeues the job, it is never marked failed');
  } finally { job.close(); }
});
