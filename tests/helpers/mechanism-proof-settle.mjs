// The private workflow/READ settlement fixture shared by mechanism proof specs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileReport, inspectLedger, ledgerFileFor, openLedger, writeContract, recordCheckRun } from '../../engine/db/ledger.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { GATE_SCHEMA } from '../../scripts/gates/gate.mjs';
import { captureGateBinding } from '../../scripts/kernel/gate-settle.mjs';
import { registerWorkflowWorktree } from '../../scripts/kernel/workflow-worktree.mjs';
import { sha256File } from '../../engine/digest.mjs';
import { seedWorkflow } from './ledger-fixture.mjs';
const ROOT = path.resolve(import.meta.dirname, '../..');
const API = path.join(ROOT, 'scripts/kernel/cli.mjs');
export const tmp = (t, prefix = 'starci-op-proof-') => { const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix))); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };
export const put = (root, rel, body) => { const abs = path.join(root, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, body); return rel; };
export const gitIn = (cwd) => (...args) => { const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
export function seedOp(t, { label, op, docs, admittedAt = null, ownedPaths = ['docs/'], recordFiles = [] }) {
  const base = tmp(t, 'starci-op-proof-settle-'), repo = path.join(base, 'main'), tree = path.join(base, 'workflow');
  fs.mkdirSync(repo);
  const env = { ...process.env, [TEST_REGISTRY_ENV]: path.join(base, 'machine.sqlite'),
    STARCI_PROJECTS_ROOT: path.join(base, 'projects'), STARCI_ARTIFACT_ROOT: path.join(base, 'artifacts'),
    STARCI_LOCAL_ROOT: path.join(base, 'local'), STARCI_OWNER_ROOT: path.join(base, 'owner'), STARCI_LANES_ROOT: path.join(base, 'lanes') };
  delete env.STARCI_CALLER;
  const git = gitIn(repo);
  git('init', '--quiet', '-b', 'main');
  for (const [k, v] of [['user.email', 'lane@starci.test'], ['user.name', 'lane'], ['core.autocrlf', 'false'], ['commit.gpgsign', 'false']]) git('config', k, v);
  put(repo, 'docs/a.md', '# a\n');
  git('add', '.'); git('commit', '--quiet', '-m', 'init');
  const branch = 'branch-' + label;
  git('worktree', 'add', '-q', '-b', branch, tree, 'main');
  const treeGit = gitIn(tree);
  registerWorkflowWorktree({ env }, { workflowId: `wf-${label}`, orcaWorktreeId: 'fixture::' + label, path: tree, branch });
  const files = ['docs/a.md', ...recordFiles];
  // Accepted proof bytes remain owned changes until the real runtime checkpoint commits them.
  const head = treeGit('rev-parse', 'HEAD');
  // Capture admission before producing attachments; native observations are still independently required.
  const admissionAt = admittedAt ?? Date.now() - 1000;
  const proofDocs = typeof docs === 'function' ? docs({ repo, tree, base, env }) : docs;
  for (const [name, doc] of Object.entries(proofDocs)) {
    const proof = doc?.schema === GATE_SCHEMA ? { ...doc, root: tree, base: head, head } : doc;
    files.push(put(tree, `docs/checks/${name}`, Buffer.isBuffer(proof) ? proof : JSON.stringify(proof)));
  }
  const jobId = `op-${op}-${label}`;
  const ledger = openLedger({ file: ledgerFileFor(repo, { env }) });
  try {
    seedWorkflow(ledger, { id: `wf-${label}`, state: { phase: 'running', job: 'impl' },
      jobs: [{ jobId, opId: op, dispatchId: `ctx-${jobId}`, terminalHandle: `term-${jobId}`, status: 'running',
        payload: { opId: op, owned_paths: ownedPaths, orca: { dispatchId: `ctx-${jobId}`, agentTerminalHandle: `term-${jobId}` } } }] });
    const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
    ledger.transaction((db) => {
      writeContract(db, { attemptId, markdown: '# contract', context: { worktree: tree, packet: { context: {
        selected_op: { mode: null, contract: { id: op, reads: [{ id: 'standard', path: 'docs/architecture.md' }] }, checks: { required: [], candidates: [] } },
        readRefs: [{ path: 'docs/architecture.md', absolute: path.join(ROOT, 'docs/architecture.md'), rootKind: 'source', root: ROOT, sha256: sha256File(path.join(ROOT, 'docs/architecture.md')) }],
        owned_paths: ownedPaths.map((owned) => ({ root: tree, path: owned })),
      gate_binding: captureGateBinding(ownedPaths.map((owned) => ({ base: tree, path: owned })), { at: admissionAt }) } } }, createdAt: admissionAt });
      fileReport(db, { attemptId, outcome: 'done', createdAt: Date.now(),
        report: { schema: 'starci/op-report@1', outcome: 'done', summary: 'slice', files, head: treeGit('rev-parse', 'HEAD') } });
      for (const check of [{ name: 'owned-paths-committed', command: 'git show' }, { name: 'owned-paths-clean', command: 'git status' }, { name: 'head-ancestor', command: 'git merge-base' }])
        recordCheckRun(db, { attemptId, name: check.name, phase: 'verify', runner: 'kernel', authority: 'runtime', status: 'pass', exitCode: 0, command: check.command });
    });
  } finally { ledger.close(); }
  return { repo, tree, env, jobId, base };
}
export const settle = ({ repo, env }, jobId) => { const r = spawnSync(process.execPath, [API, 'settle', '--repo', repo, '--job', jobId, '--verdict', 'pass', '--json'], { cwd: ROOT, env, encoding: 'utf8', windowsHide: true, timeout: 120000 }); let body = null; try { body = JSON.parse(r.stdout); } catch { /* judged below */ } return { r, body }; };
export const read = ({ repo, env }, fn) => { const l = inspectLedger({ file: ledgerFileFor(repo, { env }) }); try { return fn(l.db); } finally { l.close(); } };
