import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { hookDecision, boundGuard } from '../../scripts/guards/command-guard.mjs';
import { guardsRoot, guardLaunch, bindGuardTerminal, ensureHistoryHook, writeJobGuard, guardReceiptErrors, HOOK_VERSION } from '../../scripts/guards/hook-install.mjs';
import { inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';

// Contract change kernel-guard-file (lane C0-KGUARD): the Kernel had no job guard, so the PreToolUse command guard let
// every Kernel shell command through. Its launch now writes a guard of role kernel (no owned path, its workflow
// worktree) and binds it to the Kernel's Orca terminal: the Kernel is refused what an op is refused, and its api verbs
// pass. No refused command below is ever run: the guard judges the text.
process.env.STARCI_SLEEP_SCALE ??= '0.02';
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const tempDir = (t, prefix) => { const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix))); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };
const git = (cwd, args, env = {}) => spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });

// A guard root with the Kernel's guard of one workflow bound to an Orca terminal, as start-workflow.mjs leaves it.
const kernelSeat = (t) => {
  const skillRoot = tempDir(t, 'kguard-root-');
  const worktree = path.join(tempDir(t, 'kguard-wt-'), 'wf-kguard');
  fs.mkdirSync(path.join(worktree, 'be', 'src'), { recursive: true });
  const { receipt } = guardLaunch({ skillRoot, jobId: 'kernel-wf-kguard', workflowId: 'wf-kguard', ledgerRepo: worktree, owned: [], repos: [],
    role: 'kernel', workflowWorktree: worktree });
  const handle = `term_kguard-${process.pid}`;
  bindGuardTerminal({ skillRoot, handle, jobFile: receipt.jobFile });
  const decide = (command, { cwd = worktree, tool = 'Bash' } = {}) =>
    hookDecision({ tool_name: tool, cwd, tool_input: { command } }, { env: { ...process.env, ORCA_TERMINAL_HANDLE: handle }, root: skillRoot });
  return { skillRoot, worktree, handle, receipt, decide };
};

test("the Kernel's guard file is written at launch with its workflow worktree, role kernel and no owned path", (t) => {
  const { skillRoot, worktree, handle, receipt } = kernelSeat(t);
  assert.deepEqual(guardReceiptErrors(receipt), []);
  const guard = boundGuard(handle, { root: skillRoot });
  assert.equal(guard.schema, 'starci/op-guard@1');
  assert.equal(guard.role, 'kernel');
  assert.equal(guard.jobId, 'kernel-wf-kguard');
  assert.equal(guard.workflowId, 'wf-kguard');
  assert.equal(guard.workflowWorktree, path.resolve(worktree));
  assert.deepEqual(guard.owned, []);
  assert.equal(guard.terminal, handle);
  // An op's guard keeps the op role; an unknown role is never written.
  const op = writeJobGuard({ skillRoot, jobId: 'op-x', workflowId: 'wf-kguard', ledgerRepo: null, owned: [] });
  assert.equal(JSON.parse(fs.readFileSync(op, 'utf8')).role, 'op');
  assert.throws(() => writeJobGuard({ skillRoot, jobId: 'x', workflowId: 'w', ledgerRepo: null, owned: [], role: 'supervisor' }), /unknown guard role/);
});

test("a raw git commit or git worktree add from the Kernel's terminal is refused, like every rule an op meets", async (t) => {
  const { decide, worktree } = kernelSeat(t);
  const refused = [
    ['git commit -m "kernel wip"', 'WORKFLOW_HISTORY_CHANGE'],
    ['git reset --hard', 'WORKFLOW_HISTORY_CHANGE'],
    [`git -C ${worktree.replace(/\\/g, '/')} push origin HEAD`, 'WORKFLOW_HISTORY_CHANGE'],
    ['git worktree add ../side HEAD', 'WORKTREE_NOT_OPS'],
    ['rm -rf be/src', null],
    ['taskkill /F /IM node.exe', null],
    ['orca terminal create --worktree path:x --command claude', 'RAW_TERMINAL_CREATE'],
    ['codex exec "do the op"', 'AGENT_HEADLESS_LAUNCH'],
    ['claude -p "do the op"', 'AGENT_HEADLESS_LAUNCH'],
  ];
  for (const [command, code] of refused) {
    const decision = await decide(command);
    assert.ok(decision, `refused: ${command}`);
    if (code) assert.equal(decision.verdict.code, code, command);
    assert.equal(decision.guard.jobId, 'kernel-wf-kguard');
  }
  // The same refusal through Claude's PowerShell tool.
  assert.ok(await decide('Remove-Item -Recurse -Force be', { tool: 'PowerShell' }));
  assert.ok(await decide('Stop-Process -Name node', { tool: 'PowerShell' }));
});

test("the Kernel's legitimate api calls, git reads and Orca orchestration pass", async (t) => {
  const { decide } = kernelSeat(t);
  const api = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs').replace(/\\/g, '/');
  for (const command of [
    `node ${api} status --repo D:/app --workflow wf-kguard`,
    `node ${api} dispatch-ready --repo D:/app --workflow wf-kguard`,
    `node ${api} log --repo D:/app --workflow wf-kguard --kind decision --msg "next slice" --data '{"why":"the runtime runs git commit at settle"}'`,
    `node ${api} settle --repo D:/app --job op-a --verdict pass`,
    'git status --short',
    'git log --oneline -5',
    'git diff HEAD',
    'orca orchestration worker-show --dispatch d-1 --json',
  ]) assert.equal(await decide(command), null, command);
});

test('the history hook skips a kernel guard (the runtime git under its api calls) and still refuses an op', (t) => {
  const repo = tempDir(t, 'kguard-repo-');
  for (const args of [['init', '-q', '-b', 'main'], ['config', 'user.email', 't@t'], ['config', 'user.name', 't'], ['config', 'commit.gpgsign', 'false']]) git(repo, args);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'a\n');
  git(repo, ['add', '.']); git(repo, ['commit', '-q', '-m', 'base']);
  const skillRoot = tempDir(t, 'kguard-hook-root-');
  const hook = ensureHistoryHook(repo, { skillRoot });
  assert.equal(hook.installed, true);
  assert.match(fs.readFileSync(hook.path, 'utf8'), new RegExp(`v${HOOK_VERSION}\\b`));
  const bind = (role, handle) => bindGuardTerminal({ skillRoot, handle, jobFile: writeJobGuard({ skillRoot, jobId: `${role}-job`, workflowId: 'wf', ledgerRepo: null, owned: [], role }) });
  bind('kernel', 'term_kernel');
  bind('op', 'term_op');
  const scratch = path.join(tempDir(t, 'kguard-scratch-'), 'land');
  // A runtime scratch tree created by the api under the Kernel's terminal (createScratchWorktree) lands.
  const kernel = git(repo, ['worktree', 'add', '--detach', scratch, 'HEAD'], { ORCA_TERMINAL_HANDLE: 'term_kernel' });
  assert.equal(kernel.status, 0, kernel.stderr);
  git(repo, ['worktree', 'remove', '--force', scratch]);
  // The same call under an op's terminal stays refused.
  const op = git(repo, ['worktree', 'add', '--detach', scratch, 'HEAD'], { ORCA_TERMINAL_HANDLE: 'term_op' });
  assert.notEqual(op.status, 0);
  assert.match(op.stderr, /an op worker never creates a git worktree/);
});

test('start-workflow binds the Kernel guard to the terminal worker-start names and records the receipt on kernel-booted', (t) => {
  const root = tempDir(t, 'kguard-start-');
  const repo = path.join(root, 'repo');
  fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
  const ownerRoot = path.join(root, 'owner');
  fs.mkdirSync(ownerRoot);
  fs.writeFileSync(path.join(ownerRoot, 'config.yaml'), 'language: vi\neffort: medium\nkernel: {agent: codex, model: gpt-6-sol, effort: high}\n');
  const fake = path.join(root, 'fake-orca.mjs');
  const state = path.join(root, 'orca-state.json');
  fs.writeFileSync(state, JSON.stringify({ sends: 0, counter: 0, terminals: {}, commands: [] }));
  fs.writeFileSync(fake, FAKE_ORCA);
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([fake]), STARCI_FAKE_ORCA_STATE: state,
    STARCI_FAKE_ORCA_LOG: path.join(root, 'calls.jsonl'), STARCI_FAKE_ORCA_UNIQUE_TERMINALS: '1', STARCI_OWNER_ROOT: ownerRoot,
    STARCI_TEST_MACHINE_FILE: path.join(root, 'machine.sqlite'), ORCA_TERMINAL_HANDLE: '' };
  const run = (script, ...args) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', ...script), ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env });
  const defined = run(['goal', 'define-goal.mjs'], '--repo', repo, '--text', 'guard the kernel', '--json');
  assert.equal(defined.status, 0, defined.stderr);
  const workflowId = JSON.parse(defined.stdout).workflowId;
  const started = run(['kernel', 'start-workflow.mjs'], '--repo', repo, '--goal', workflowId, '--json');
  assert.equal(started.status, 0, started.stderr);
  const out = JSON.parse(started.stdout);
  const terminalFile = path.join(guardsRoot(ROOT), 'terminals', `${out.terminal.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
  t.after(() => { fs.rmSync(terminalFile, { force: true }); fs.rmSync(path.join(guardsRoot(ROOT), 'jobs', `kernel-${workflowId}.json`), { force: true }); });
  const guard = boundGuard(out.terminal, { root: ROOT });
  assert.ok(guard, 'the guard is bound to the Kernel terminal');
  assert.equal(guard.role, 'kernel');
  assert.equal(guard.jobId, `kernel-${workflowId}`);
  assert.equal(guard.workflowId, workflowId);
  assert.equal(guard.ledgerRepo, path.resolve(repo));
  assert.equal(guard.workflowWorktree, out.workflowWorktree?.path ? path.resolve(out.workflowWorktree.path) : null);
  assert.deepEqual(guard.owned, []);
  assert.equal(out.guard.terminal, terminalFile);
  assert.equal(out.guard.code, undefined, 'a whole guard carries no kernel-guard-unbound');
  const ledger = inspectLedger({ file: ledgerFileFor(repo) });
  try {
    const booted = JSON.parse(ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-booted' ORDER BY seq DESC LIMIT 1").get(workflowId).payload_json);
    assert.equal(booted.guard.jobFile, out.guard.jobFile);
    assert.equal(booted.guard.terminal, terminalFile);
  } finally { ledger.close(); }
});
