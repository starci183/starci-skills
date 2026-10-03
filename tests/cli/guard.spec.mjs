import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { CATALOG as catalog } from '../../packages/cli/src/catalog.generated.mjs';
import { main as publishedMain } from '../../packages/cli/src/main.mjs';
import { main as runtimeMain } from '../../scripts/cli/main.mjs';
import { toolGuardCommand } from '../../scripts/agent/trust.mjs';
import { historyHookBody } from '../../scripts/guards/hook-install.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

test('guard catalog resolves every handler and validates verify-commit positionals', () => {
  const calls = [];
  const runScript = (script, args) => { calls.push({ script, args }); return 0; };
  assert.equal(runtimeMain(['guard', 'command'], { catalog, runScript }), 0);
  assert.equal(runtimeMain(['guard', 'seat-tools'], { catalog, runScript }), 0);
  assert.equal(runtimeMain(['guard', 'footprint-scan', '--root', '.', '--depth', '2', '--json'], { catalog, runScript }), 0);
  assert.equal(runtimeMain(['guard', 'verify-commit', 'old', 'new'], { catalog, runScript }), 0);
  assert.deepEqual(calls.map((call) => path.basename(call.script)), ['command-guard.mjs', 'seat-tools.mjs', 'footprint-scan.mjs', 'verify-commit.mjs']);
  assert.equal(runtimeMain(['guard', 'verify-commit', 'old'], { catalog, stderr: () => {}, runScript }), 2);
});

test('published guard command uses the in-process fast path before catalog loading', async () => {
  let imported = null;
  const code = await publishedMain(['guard', 'command'], {
    cwd: ROOT,
    locateRuntime: () => ({ root: ROOT }),
    importGuard: async (file) => { imported = file; return { main: async ({ stdin }) => stdin === 'input-seam' ? 2 : 1 }; },
    stdin: 'input-seam',
    stderr: () => {},
  });
  assert.equal(code, 2);
  assert.match(imported, /scripts[\\/]guards[\\/]command-guard\.mjs$/);
});

test('PreToolUse hooks use starci while the PATH-independent git hook stays internal', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
  const commands = settings.hooks.PreToolUse.flatMap((group) => group.hooks.map((hook) => hook.command));
  assert.ok(commands.includes('starci guard command'));
  assert.ok(commands.includes('starci guard seat-tools'));
  assert.equal(toolGuardCommand(), 'starci guard command');
  const history = historyHookBody({ branches: ['main'], nodePath: '/runtime/node', root: '/runtime' });
  assert.match(history, /STARCI_RUNTIME='\/runtime' '\/runtime\/node' '\/runtime\/packages\/cli\/bin\/starci\.mjs' guard verify-commit/);
  assert.equal(catalog.groups.guard.verbs['verify-commit'].removed.length, 0);
});

test('guard dispatcher preserves refusal exit, stdout and stderr byte-for-byte', (t) => {
  const guards = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-guard-cli-'));
  t.after(() => fs.rmSync(guards, { recursive: true, force: true }));
  fs.mkdirSync(path.join(guards, 'terminals'), { recursive: true });
  fs.writeFileSync(path.join(guards, 'terminals', 'term_cli.json'), JSON.stringify({ schema: 'starci/op-guard@1', role: 'op', jobId: 'job-cli', workflowId: 'wf-cli', owned: [], terminal: 'term_cli' }));
  const input = JSON.stringify({ tool_name: 'PowerShell', tool_input: { command: 'Stop-Process -Name node -Force' }, cwd: ROOT });
  const env = { ...process.env, STARCI_RUNTIME: ROOT, STARCI_GUARDS_ROOT: guards, ORCA_TERMINAL_HANDLE: 'term_cli' };
  const direct = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'guards', 'command-guard.mjs')], { cwd: ROOT, env, input, encoding: 'utf8' });
  const dispatched = spawnSync(process.execPath, [path.join(ROOT, 'packages', 'cli', 'bin', 'starci.mjs'), 'guard', 'command'], { cwd: ROOT, env, input, encoding: 'utf8' });
  assert.deepEqual({ status: dispatched.status, stdout: dispatched.stdout, stderr: dispatched.stderr }, { status: direct.status, stdout: direct.stdout, stderr: direct.stderr });
  assert.equal(direct.status, 2);
  assert.match(direct.stderr, /PID you started/);
});
