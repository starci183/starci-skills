import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { codexGuardBlock, toolGuardCommand } from '../../scripts/agent/trust.mjs';
import { codexMirrorSource } from '../../scripts/agent/codex-mirror-source.mjs';
import { ensureLaunchTrust as ensureAdoptedLaunchTrust } from '../../scripts/agent/trust-launch.mjs';

// Orca 1.4.209 (managed-hook-runtime: mirror of the system Codex config) rebuilds the managed Codex home's config.toml from
// the system home's <home>/.codex/config.toml at every launch and keeps only the managed file's [projects.*] and
// [hooks.state.*] tables. Observed 2026-10-07 on a real launch: the runtime wrote the guard block to the managed home,
// `worker-start` ran, and five seconds later the managed config.toml held no `starci guard`, while its hook-state table
// stayed. The guard then reaches no Codex worker. These specs replay that with the mirror as a function.

const tmp = (t, prefix) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(d, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return d;
};
const ensureLaunchTrust = (options) => ensureAdoptedLaunchTrust({
  ...options,
  config: { launchTrust: { profile: 'automatic', approvedBy: 'owner', approvalRef: 'private fixture owner adoption', roots: [path.resolve(options.cwd)] } },
});

const KEPT_HEADER = /^\[(?:projects|hooks\.state)(?:\.|\])/;
// Orca's mirror: the system config, then the managed file's project and hook-state tables.
function orcaMirror(systemText, managedText) {
  const kept = [];
  let keep = false;
  for (const line of managedText.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) keep = KEPT_HEADER.test(line.trim());
    if (keep) kept.push(line);
  }
  return `${systemText.trimEnd()}\n\n${kept.join('\n')}\n`;
}

// The app-server seam: hooks/list answers from the home's config.toml, config/batchWrite appends a hook-state table.
function appServerFor(command) {
  return ({ home, requests }) => requests.map((q) => {
    const file = path.join(home, 'config.toml');
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (q.method === 'config/batchWrite') {
      fs.appendFileSync(file, `\n[hooks.state.'${file}:pre_tool_use:0:0']\ntrusted_hash = "sha256:abc"\n`);
      return {};
    }
    const trusted = text.includes(`[hooks.state.'${file}:pre_tool_use:0:0']`);
    const hooks = text.includes(codexGuardBlock(command)) ? [{ key: `${file}:pre_tool_use:0:0`, eventName: 'preToolUse', command, currentHash: 'sha256:abc', trustStatus: trusted ? 'trusted' : 'untrusted' }] : [];
    return { data: [{ cwd: q.params.cwds[0], hooks, warnings: [], errors: [] }] };
  });
}

test('the guard hook survives Orca mirroring the system Codex config into the managed home', (t) => {
  const trustHome = tmp(t, 'starci-codex-mirror-home-');
  const cwd = tmp(t, 'starci-codex-mirror-cwd-');
  const command = toolGuardCommand();
  const managedDir = path.join(trustHome, '.codex');
  const sourceDir = path.join(trustHome, 'system', '.codex');
  const managedFile = path.join(managedDir, 'config.toml');
  const sourceFile = path.join(sourceDir, 'config.toml');
  fs.mkdirSync(managedDir, { recursive: true });
  fs.mkdirSync(sourceDir, { recursive: true });
  const ownerSettings = 'model = "gpt-6.1-sol"\napproval_policy = "never"\n';
  fs.writeFileSync(sourceFile, ownerSettings);
  fs.writeFileSync(managedFile, ownerSettings);
  const env = { NODE_TEST_CONTEXT: 'child-v8', STARCI_AGENT_TRUST_HOME: trustHome };

  const r = ensureLaunchTrust({ agent: 'codex', cwd, env, codexAppServer: appServerFor(command) });
  assert.notEqual(r.status, 'failed', JSON.stringify(r));
  assert.deepEqual(r.toolGuard.map((g) => g.file), [managedFile, sourceFile], 'the managed home and the home Orca mirrors from both carry the guard');
  assert.deepEqual(r.toolGuard.map((g) => g.trustedIn[0].trusted), ['written', 'written']);

  // worker-start: Orca rebuilds the managed config from the system one and keeps the managed project and hook-state tables.
  const mirrored = orcaMirror(fs.readFileSync(sourceFile, 'utf8'), fs.readFileSync(managedFile, 'utf8'));
  assert.ok(mirrored.includes(codexGuardBlock(command)), 'the mirrored managed config still holds the guard block');
  assert.ok(mirrored.includes(`[hooks.state.'${managedFile}:pre_tool_use:0:0']`), 'and the hook-state table that trusts it');

  // The same launch, as before this change, with the guard only in the managed home: the mirror erases it.
  const lone = tmp(t, 'starci-codex-mirror-lone-');
  fs.writeFileSync(path.join(lone, 'config.toml'), `${codexGuardBlock(command)}\n[hooks.state.'x:pre_tool_use:0:0']\ntrusted_hash = "sha256:abc"\n`);
  const erased = orcaMirror(ownerSettings, fs.readFileSync(path.join(lone, 'config.toml'), 'utf8'));
  assert.ok(!erased.includes('starci guard'), 'a guard written only to the managed home does not survive the mirror');
});

test('a system Codex home without a config.toml is left alone: Orca refuses a blank source and a guard-only file would replace the owner settings', (t) => {
  const trustHome = tmp(t, 'starci-codex-mirror-absent-');
  const cwd = tmp(t, 'starci-codex-mirror-absent-cwd-');
  fs.mkdirSync(path.join(trustHome, '.codex'), { recursive: true });
  const env = { NODE_TEST_CONTEXT: 'child-v8', STARCI_AGENT_TRUST_HOME: trustHome };
  const r = ensureLaunchTrust({ agent: 'codex', cwd, env, codexAppServer: appServerFor(toolGuardCommand()) });
  assert.notEqual(r.status, 'failed', JSON.stringify(r));
  assert.deepEqual(r.toolGuard.map((g) => g.file), [path.join(trustHome, '.codex', 'config.toml')]);
  assert.equal(fs.existsSync(path.join(trustHome, 'system')), false);
});

test('the mirror source is the system home, absent for an explicit CODEX_HOME, and re-rooted under a trust home', () => {
  assert.equal(codexMirrorSource({ env: {} }), path.join(os.homedir(), '.codex'));
  assert.equal(codexMirrorSource({ env: { CODEX_HOME: '/elsewhere' } }), null, 'nothing mirrors into a Codex home Orca does not manage');
  assert.equal(codexMirrorSource({ env: { STARCI_AGENT_TRUST_HOME: '/t', CODEX_HOME: '/real' } }), path.join('/t', 'system', '.codex'));
});
