import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnAgent, startAgent, loadAdapter } from '../../scripts/agent/lib.mjs';
import { projectTargets, claudeKeyForms } from '../../scripts/agent/trust.mjs';
import { ensureLaunchTrust } from '../../scripts/agent/trust-launch.mjs';
import { fakeAdmission } from '../helpers/fake-admission.mjs';
import { installGuardLauncher } from '../helpers/guard-launcher.mjs';

// Launch preconditions per provider card (owner order 2026-10-02: no first-run dialog, no approval prompt, the command guard
// stays on). Bypass itself is Orca's (settings.agentDefaultArgs); the runtime's part is trust, the guard hook and the model.
const tmp = (t, prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); t.after(() => fs.rmSync(d, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return d; };
const withTrust = (t) => { const home = tmp(t, 'starci-card-trust-'); installGuardLauncher(home); return { STARCI_AGENT_TRUST_HOME: home, home }; };

test('a fresh worktree path gets its trust and the command guard hook before launch, for every launchable card', (t) => {
  for (const agent of ['claude', 'codex', 'devin']) {
    const fx = withTrust(t);
    const dir = tmp(t, `starci-card-${agent}-`);
    const r = ensureLaunchTrust({ agent, cwd: dir, config:{launchTrust:{profile:'automatic',approvedBy:'owner',approvalRef:'private card fixture adoption',roots:[dir]}}, env: { STARCI_AGENT_TRUST_HOME: fx.STARCI_AGENT_TRUST_HOME }, platform: 'win32' });
    assert.notEqual(r?.status, 'failed', `${agent}: ${JSON.stringify(r?.errors)}`);
    assert.deepEqual(r.errors ?? [], [], `${agent}: no write error`);
    const project = projectTargets(path.resolve(dir));
    const guardFile = { claude: project.claudeSettings, codex: path.join(fx.STARCI_AGENT_TRUST_HOME, '.codex', 'config.toml'), devin: project.devinConfig }[agent];
    assert.ok(fs.existsSync(guardFile), `${agent}: the project file that registers the command guard exists before launch`);
    assert.match(fs.readFileSync(guardFile, 'utf8'), /command-guard|PreToolUse/i, `${agent}: the PreToolUse command guard is registered next to the launch settings`);
    if (agent === 'claude') {
      const json = JSON.parse(fs.readFileSync(path.join(fx.home, '.claude.json'), 'utf8'));
      for (const key of claudeKeyForms(dir, 'win32')) assert.equal(json.projects?.[key]?.hasTrustDialogAccepted, true, `claude: workspace trust for ${key}`);
      assert.equal(r.bypassConsent !== undefined, true, 'claude: the bypass-permissions consent is asserted');
    }
  }
});

test('an eligible Op that names no model starts the card\'s admitted model, never the user\'s default', () => {
  const calls = [];
  const io = { admission: fakeAdmission(), assignee: () => ({ ok: true, assigneeHandle: 'term' }), trust: () => ({ status: 'ok', paths: [] }),
    start: (a) => { calls.push(a); return { ok: true, outcome: 'ok', dispatchId: 'd1', taskId: 't1', agentTerminalHandle: 'term' }; },
    rename: () => ({ ok: true }),
    show: () => ({ ok: true, state: 'ready', dispatch: { depth: 1 }, effective: { agent: 'codex', model: 'gpt-6-luna' } }) };
  const card = loadAdapter('codex').card;
  // The card's `defaultModel: pool` resolves through the provider pool's registry.yaml defaultModel.
  assert.equal(card.start.defaultModel, 'pool');
  const eligible = (model) => [{ provider: 'codex', model, eligibility: { eligible: true, mode: 'operation-policy', reasons: [] } }];
  const r = spawnAgent({ provider: 'codex', role: 'op', allowGroup: eligible('gpt-6-luna'), worktree: 'x', title: 't', spec: 's', task: 't1', run: 'run_1', request: { a: 1 }, io });
  assert.equal(r.ok, true, r.error);
  assert.equal(calls[0].model, 'gpt-6-luna');
  assert.equal(r.admission.receipt.model, 'gpt-6-luna', 'the resolved default passes the common gate as a concrete model');
  const named = spawnAgent({ provider: 'codex', model: 'gpt-6.1-sol', role: 'op', allowGroup: eligible('gpt-6.1-sol'), worktree: 'x', title: 't', spec: 's', task: 't1', run: 'run_1', request: { a: 2 }, io: { ...io, show: () => ({ ok: true, state: 'ready', dispatch: { depth: 1 }, effective: { agent: 'codex', model: 'gpt-6.1-sol' } }) } });
  assert.equal(calls.at(-1).model, 'gpt-6.1-sol', 'a named model is kept');
  assert.equal(named.ok, true, named.error);
});

test('startAgent admits a declared default before creating its Run; blocked quota still refuses before any host effect', () => {
  const calls = [], admission = fakeAdmission();
  const io = { admission, runCreate: () => { calls.push('run'); return { ok: true, runId: 'run_default' }; }, spawn: {
    trust: () => ({ status: 'ok', paths: [] }), rename: () => ({ ok: true }),
    start: (args) => { calls.push(args); return { ok: true, dispatchId: 'ctx_default', taskId: 'task_default', agentTerminalHandle: 'term_default' }; },
    show: () => ({ ok: true, state: 'ready', effective: { agent: 'codex', model: 'gpt-6-luna' } }),
  } };
  const options = { provider: 'codex', role: 'op', allowGroup: [{ provider: 'codex', model: 'gpt-6-luna', eligibility: { eligible: true, mode: 'operation-policy', reasons: [] } }],
    worktree: 'x', title: 't', prompt: 's', objective: 'default', request: { cardDefault: 1 }, io };
  const launched = startAgent(options);
  assert.equal(launched.ok, true, launched.error);
  assert.equal(admission.calls.find(([name]) => name === 'reserve')[1].model, 'gpt-6-luna');
  assert.equal(calls[1].model, 'gpt-6-luna');
  assert.equal(calls[1].request.model, 'gpt-6-luna', 'immutable host replay uses the admitted model');
  calls.length = 0;
  const refused = startAgent({ ...options, request: { cardDefault: 2 }, io: { ...io, admission: fakeAdmission({ used: { codex: 100 } }) } });
  assert.equal(refused.ok, false);
  assert.equal(refused.effectState, 'none');
  assert.deepEqual(calls, [], 'an explicit default does not bypass quota admission');
});

test('the card default cannot lower a generic worker\'s quality floor', () => {
  const calls = [];
  const refused = spawnAgent({ provider: 'codex', run: 'run_1', request: { cardDefault: 'worker' }, io: {
    admission: fakeAdmission(), trust: () => calls.push('trust'), start: () => calls.push('start'),
  } });
  assert.equal(refused.ok, false);
  assert.equal(refused.effectState, 'none');
  assert.equal(refused.decision.rejected[0].model, 'gpt-6-luna');
  assert.ok(refused.decision.rejected[0].codes.includes('quality-floor-not-met'));
  assert.deepEqual(calls, []);
});

test('an omitted model on a card without a declared default is refused before trust or worker-start', () => {
  const calls = [];
  assert.equal(loadAdapter('claude').card.start.defaultModel, undefined);
  const refused = spawnAgent({ provider: 'claude', run: 'run_1', request: { cardDefault: 3 }, io: {
    admission: fakeAdmission(), trust: () => calls.push('trust'), start: () => calls.push('start'),
  } });
  assert.equal(refused.step, 'admission');
  assert.equal(refused.effectState, 'none');
  assert.match(refused.error, /concrete model/);
  assert.deepEqual(calls, []);
});

test('a card that takes no model flag gets none (Devin)', () => {
  assert.equal(loadAdapter('devin').card.start.modelArgument, false);
  assert.equal(loadAdapter('devin').card.start.defaultModel, undefined);
});

test('a launch whose guard command cannot run is refused at the launch-trust step with the catalogued code, before worker-start', () => {
  const calls = [];
  const io = { admission: fakeAdmission(), assignee: () => ({ ok: true, assigneeHandle: 'term' }),
    trust: () => ({ agent: 'claude', paths: [], status: 'failed', code: 'guard-command-unresolvable', reason: 'the guard command cannot run: bash exit 127', errors: [{ error: 'bash exit 127' }] }),
    start: (a) => { calls.push(a); return { ok: true }; } };
  const eligible = [{ provider: 'codex', model: 'gpt-6-luna', eligibility: { eligible: true, mode: 'operation-policy', reasons: [] } }];
  const r = spawnAgent({ provider: 'codex', role: 'op', allowGroup: eligible, worktree: 'x', title: 't', spec: 's', task: 't1', run: 'run_1', request: { a: 3 }, io });
  assert.equal(r.ok, false);
  assert.equal(r.step, 'launch-trust');
  assert.equal(r.code, 'guard-command-unresolvable');
  assert.equal(r.errorCode, 'guard-command-unresolvable');
  assert.equal(r.effectState, 'none');
  assert.deepEqual(calls, [], 'no worker starts unguarded');
});
