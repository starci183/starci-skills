import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnAgent, loadAdapter } from '../../scripts/agent/lib.mjs';
import { ensureLaunchTrust, projectTargets, claudeKeyForms } from '../../scripts/agent/trust.mjs';

// Launch preconditions per provider card (owner order 2026-10-02: no first-run dialog, no approval prompt, the command guard
// stays on). Bypass itself is Orca's (settings.agentDefaultArgs); the runtime's part is trust, the guard hook and the model.
const tmp = (t, prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); t.after(() => fs.rmSync(d, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return d; };
const withTrust = (t) => { const home = tmp(t, 'starci-card-trust-'); return { STARCI_AGENT_TRUST_HOME: home, home }; };

test('a fresh worktree path gets its trust and the command guard hook before launch, for every launchable card', (t) => {
  for (const agent of ['claude', 'codex', 'devin']) {
    const fx = withTrust(t);
    const dir = tmp(t, `starci-card-${agent}-`);
    const r = ensureLaunchTrust({ agent, cwd: dir, env: { STARCI_AGENT_TRUST_HOME: fx.STARCI_AGENT_TRUST_HOME }, platform: 'win32' });
    assert.notEqual(r?.status, 'failed', `${agent}: ${JSON.stringify(r?.errors)}`);
    assert.deepEqual(r.errors ?? [], [], `${agent}: no write error`);
    const project = projectTargets(path.resolve(dir));
    const guardFile = agent === 'claude' ? project.claudeSettings : agent === 'codex' ? project.codexConfig : project.devinConfig;
    assert.ok(fs.existsSync(guardFile), `${agent}: the project file that registers the command guard exists before launch`);
    assert.match(fs.readFileSync(guardFile, 'utf8'), /command-guard|PreToolUse/i, `${agent}: the PreToolUse command guard is registered next to the launch settings`);
    if (agent === 'claude') {
      const json = JSON.parse(fs.readFileSync(path.join(fx.home, '.claude.json'), 'utf8'));
      for (const key of claudeKeyForms(dir, 'win32')) assert.equal(json.projects?.[key]?.hasTrustDialogAccepted, true, `claude: workspace trust for ${key}`);
      assert.equal(r.bypassConsent !== undefined, true, 'claude: the bypass-permissions consent is asserted');
    }
  }
});

test('a launch that names no model starts the card\'s model, so a dead default in the user\'s own config can never be used', () => {
  const calls = [];
  const io = { assignee: () => ({ ok: true, assigneeHandle: 'term' }), trust: () => ({ status: 'ok', paths: [] }),
    start: (a) => { calls.push(a); return { ok: true, outcome: 'ok', dispatchId: 'd1', taskId: 't1', agentTerminalHandle: 'term' }; },
    rename: () => ({ ok: true }),
    show: () => ({ ok: true, state: 'ready', dispatch: { depth: 1 }, effective: { agent: 'codex', model: 'gpt-6-luna' } }) };
  const card = loadAdapter('codex').card;
  // The card's `defaultModel: pool` resolves through the provider pool's registry.yaml defaultModel.
  assert.equal(card.start.defaultModel, 'pool');
  const r = spawnAgent({ provider: 'codex', worktree: 'x', title: 't', spec: 's', task: 't1', run: 'run_1', request: { a: 1 }, io });
  assert.equal(r.ok, true, r.error);
  assert.equal(calls[0].model, 'gpt-6-luna');
  const named = spawnAgent({ provider: 'codex', model: 'gpt-6.1-sol', worktree: 'x', title: 't', spec: 's', task: 't1', run: 'run_1', request: { a: 2 }, io: { ...io, show: () => ({ ok: true, state: 'ready', dispatch: { depth: 1 }, effective: { agent: 'codex', model: 'gpt-6.1-sol' } }) } });
  assert.equal(calls.at(-1).model, 'gpt-6.1-sol', 'a named model is kept');
  assert.equal(named.ok, true, named.error);
});

test('a card that takes no model flag gets none (Devin)', () => {
  assert.equal(loadAdapter('devin').card.start.modelArgument, false);
  assert.equal(loadAdapter('devin').card.start.defaultModel, undefined);
});
