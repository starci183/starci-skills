// Launch trust refuses a launch whose guard hook command no shell can run (a non-blocking hook error would leave every
// guarded command unguarded): typed code, nothing written. With the launchers installed the same launch is trusted.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureLaunchTrust } from '../../scripts/agent/trust-launch.mjs';
import { projectTargets } from '../../scripts/agent/trust.mjs';
import { toolGuardCommand } from '../../scripts/lib/guard-command.mjs';
import { installGuardLauncher } from '../helpers/guard-launcher.mjs';

const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};
const launch = (agent, cwd, home, options = {}) => ensureLaunchTrust({
  agent, cwd, env: { NODE_TEST_CONTEXT: 'child-v8', STARCI_AGENT_TRUST_HOME: home }, ...options,
  config: { launchTrust: { profile: 'automatic', approvedBy: 'owner', approvalRef: 'private guard fixture adoption', roots: [path.resolve(cwd)] } },
});
const noFiles = (home, cwd) => !fs.existsSync(path.join(home, '.claude.json')) && !fs.existsSync(projectTargets(path.resolve(cwd)).claudeSettings);

test('a guard command that does not resolve refuses the launch for every agent, with the catalogued code, and writes nothing', (t) => {
  for (const agent of ['claude', 'codex', 'devin']) {
    const home = tmp(t, 'starci-guard-launch-home-'), cwd = tmp(t, 'starci-guard-launch-cwd-');
    const seen = [];
    const receipt = launch(agent, cwd, home, { guardProbe: (request) => { seen.push(request.command); return { ok: false, reason: 'bash exit 127: starci: command not found' }; } });
    assert.equal(receipt.status, 'failed', agent);
    assert.equal(receipt.code, 'guard-command-unresolvable');
    assert.match(receipt.reason, /cannot run: bash exit 127/);
    assert.deepEqual(seen, [toolGuardCommand({ home })], 'the probe runs the exact command launch trust would register');
    assert.ok(noFiles(home, cwd), `${agent}: no trust, settings or hook file is written`);
  }
});

test('the real probe refuses a trust home without launchers, and trusts the launch once the launchers are installed', (t) => {
  const home = tmp(t, 'starci-guard-launch-real-'), cwd = tmp(t, 'starci-guard-launch-real-cwd-');
  const refused = launch('claude', cwd, home);
  assert.equal(refused.status, 'failed', JSON.stringify(refused));
  assert.equal(refused.code, 'guard-command-unresolvable');
  assert.ok(noFiles(home, cwd));
  installGuardLauncher(home);
  const trusted = launch('claude', cwd, home);
  assert.equal(trusted.status, 'written', JSON.stringify(trusted));
  const settings = JSON.parse(fs.readFileSync(projectTargets(path.resolve(cwd)).claudeSettings, 'utf8'));
  const commands = settings.hooks.PreToolUse.flatMap((group) => group.hooks.map((hook) => hook.command));
  assert.deepEqual(commands, [toolGuardCommand({ home })], 'the registered hook is the command that was probed');
  assert.equal(launch('claude', cwd, home).status, 'already', 'a second launch changes nothing');
});

test('an older bare hook command in the project settings is replaced by the current spelling, once', (t) => {
  const home = tmp(t, 'starci-guard-launch-old-'), cwd = tmp(t, 'starci-guard-launch-old-cwd-');
  installGuardLauncher(home);
  const file = projectTargets(path.resolve(cwd)).claudeSettings;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'owner-hook' }] }, { matcher: 'Bash', hooks: [{ type: 'command', command: 'starci guard command', timeout: 30 }] }] } }));
  const first = launch('claude', cwd, home, { guardProbe: () => ({ ok: true }) });
  assert.equal(first.toolGuard[0].state, 'written');
  const commands = JSON.parse(fs.readFileSync(file, 'utf8')).hooks.PreToolUse.flatMap((group) => group.hooks.map((hook) => hook.command));
  assert.deepEqual(commands, ['owner-hook', toolGuardCommand({ home })], 'the owner hook stays; the bare command is replaced, not doubled');
  assert.equal(launch('claude', cwd, home, { guardProbe: () => ({ ok: true }) }).toolGuard[0].state, 'already');
});
