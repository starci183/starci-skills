import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hostAgentVerdict, orcaSettingsFile, modelsOfProvider } from '../../scripts/agent/host-agents.mjs';
import { spawnAgent } from '../../scripts/agent/lib.mjs';
import { fakeAdmission } from '../helpers/fake-admission.mjs';

// The host-agent preflight: an agent the host does not enable (Orca settings), cannot run (binary missing) or a model nobody
// declares is refused before any trust or worker-start. The specs use a FAKE agent, `ghost-agent`, and a temp Orca userData.
const fixture = (t, { disabled = [], overrides = {}, binary = true, defaultArgs = {} } = {}) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-host-agents-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const data = path.join(root, 'orca');
  fs.mkdirSync(path.join(data, 'profiles', 'p1'), { recursive: true });
  fs.writeFileSync(path.join(data, 'orca-profile-index.json'), JSON.stringify({ activeProfileId: 'p1' }));
  fs.writeFileSync(path.join(data, 'profiles', 'p1', 'orca-data.json'), JSON.stringify({ settings: { disabledTuiAgents: disabled, agentCmdOverrides: overrides, agentDefaultArgs: defaultArgs } }));
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  if (binary) fs.writeFileSync(path.join(bin, process.platform === 'win32' ? 'ghost-agent.exe' : 'ghost-agent'), '');
  const env = { STARCI_ORCA_USER_DATA: data };
  return { env, settingsFile: orcaSettingsFile({ env }), pathDirs: [bin] };
};
const card = { start: { agentArgument: 'ghost-agent' } };
const ask = (fx, extra = {}) => hostAgentVerdict({ provider: 'ghost-agent', model: null, card, env: fx.env, settingsFile: fx.settingsFile, pathDirs: fx.pathDirs, ...extra });

test('the settings file is the active profile\'s orca-data.json under Orca\'s userData', (t) => {
  const fx = fixture(t);
  assert.equal(path.basename(path.dirname(fx.settingsFile)), 'p1');
  assert.equal(path.basename(fx.settingsFile), 'orca-data.json');
});

test('an enabled agent with its binary installed passes', (t) => {
  assert.deepEqual(ask(fixture(t)), { ok: true });
});

test('an agent Orca disables is refused agent-disabled-on-host', (t) => {
  const r = ask(fixture(t, { disabled: ['ghost-agent'] }));
  assert.equal(r.ok, false);
  assert.equal(r.code, 'agent-disabled-on-host');
  assert.match(r.error, /disabledTuiAgents/);
});

test('an agent whose binary is not installed is refused agent-binary-missing, naming the binary', (t) => {
  const r = ask(fixture(t, { binary: false }));
  assert.equal(r.code, 'agent-binary-missing');
  assert.match(r.error, /'ghost-agent'/);
  const named = ask(fixture(t, { binary: false }), { card: { start: { agentArgument: 'ghost-agent', cli: 'ghost-cli' } } });
  assert.match(named.error, /'ghost-cli'/, 'the card names the binary');
});

test('an Orca command override names the binary that must exist', (t) => {
  const r = ask(fixture(t, { overrides: { 'ghost-agent': 'ghost-wrapper --flag' } }));
  assert.equal(r.code, 'agent-binary-missing');
  assert.match(r.error, /'ghost-wrapper'/);
});

test('a model nobody declares for the provider is refused model-not-listed; a declared one and a no-model card pass', (t) => {
  const fx = fixture(t);
  const models = new Set(['ghost-1']);
  assert.equal(ask(fx, { model: 'ghost-9', models }).code, 'model-not-listed');
  assert.equal(ask(fx, { model: 'ghost-1', models }).ok, true);
  assert.equal(ask(fx, { model: 'ghost-9', models, card: { start: { agentArgument: 'ghost-agent', modelArgument: false } } }).ok, true);
});

test('the declared models of the real providers come from the runtime tables, not a list in the check', () => {
  assert.ok(modelsOfProvider('claude').size > 0);
  assert.equal(modelsOfProvider('ghost-agent').size, 0);
});

test('a test process reads no host state unless a spec supplies it', () => {
  assert.equal(hostAgentVerdict({ provider: 'ghost-agent', card, env: { NODE_TEST_CONTEXT: 'child-v8' } }).skipped !== undefined, true);
});

test('spawnAgent refuses before trust and worker-start, and starts when the host allows the agent', () => {
  const calls = [];
  const rec = (name, out) => () => { calls.push(name); return out; };
  const base = { provider: 'claude', model: 'claude-opus-5-5', worktree: 'x', title: 't', spec: 's', run: 'run_1', request: { a: 1 } };
  const io = (hostAgent) => ({ admission: fakeAdmission(), hostAgent, trust: rec('trust', { status: 'ok', paths: [] }), start: rec('worker-start', { ok: true, outcome: 'ok', dispatchId: 'd1', taskId: 't1', agentTerminalHandle: 'term' }),
    rename: rec('rename', { ok: true }), show: rec('show', { ok: true, state: 'ready', dispatch: { depth: 1 }, effective: { agent: 'claude', model: 'claude-opus-5-5' } }) });
  const refused = spawnAgent({ ...base, io: io(() => ({ ok: false, code: 'agent-disabled-on-host', error: 'ghost' })) });
  assert.deepEqual([refused.ok, refused.step, refused.code, refused.effectState], [false, 'host-agent', 'agent-disabled-on-host', 'none']);
  assert.deepEqual(calls, [], 'no trust, no worker-start');
  const ok = spawnAgent({ ...base, io: io(() => ({ ok: true })) });
  assert.equal(ok.ok, true, ok.error);
  assert.ok(calls.includes('worker-start'));
});

test('an agent whose Orca default args lack the card bypass flag is refused agent-bypass-missing; with the flag it passes', (t) => {
  const withFlag = { start: { agentArgument: 'ghost-agent', bypassFlag: '--ghost-bypass' } };
  const missing = ask(fixture(t, { defaultArgs: { 'ghost-agent': '--other' } }), { card: withFlag });
  assert.equal(missing.code, 'agent-bypass-missing');
  assert.match(missing.error, /--ghost-bypass/);
  assert.equal(ask(fixture(t), { card: withFlag }).code, 'agent-bypass-missing', 'no default args at all');
  assert.equal(ask(fixture(t, { defaultArgs: { 'ghost-agent': '--x --ghost-bypass' } }), { card: withFlag }).ok, true);
  assert.equal(ask(fixture(t)).ok, true, 'a card without bypassFlag asks nothing');
});

test('every real card declares its bypass flag as data', async () => {
  const { loadAdapter } = await import('../../scripts/agent/lib.mjs');
  for (const agent of ['claude', 'codex', 'devin']) assert.match(loadAdapter(agent).card.start.bypassFlag, /^--/, agent);
});

test('the cursor card passes the preflight when cursor-agent is installed and bypassed, and is refused naming cursor-agent when it is not', async (t) => {
  const { loadAdapter } = await import('../../scripts/agent/lib.mjs');
  const card = loadAdapter('cursor').card;
  assert.equal(card.start.cli, 'cursor-agent');
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-cursor-bin-'));
  t.after(() => fs.rmSync(bin, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const base = fixture(t, { defaultArgs: { cursor: '--yolo' } });
  const missing = hostAgentVerdict({ provider: 'cursor', model: null, card, env: base.env, settingsFile: base.settingsFile, pathDirs: [bin] });
  assert.equal(missing.code, 'agent-binary-missing');
  assert.match(missing.error, /'cursor-agent'/);
  fs.writeFileSync(path.join(bin, process.platform === 'win32' ? 'cursor-agent.exe' : 'cursor-agent'), '');
  assert.equal(hostAgentVerdict({ provider: 'cursor', model: null, card, env: base.env, settingsFile: base.settingsFile, pathDirs: [bin], models: new Set() }).ok, true);
  const noBypass = fixture(t, { defaultArgs: {} });
  assert.equal(hostAgentVerdict({ provider: 'cursor', model: null, card, env: noBypass.env, settingsFile: noBypass.settingsFile, pathDirs: [bin] }).code, 'agent-bypass-missing');
});

test('a provider with no declared models (cursor: Orca lists them dynamically) is not judged on its model', async (t) => {
  const { loadAdapter } = await import('../../scripts/agent/lib.mjs');
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-cursor-bin-'));
  t.after(() => fs.rmSync(bin, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  fs.writeFileSync(path.join(bin, process.platform === 'win32' ? 'cursor-agent.exe' : 'cursor-agent'), '');
  const fx = fixture(t, { defaultArgs: { cursor: '--yolo' } });
  assert.equal(hostAgentVerdict({ provider: 'cursor', model: 'auto', card: loadAdapter('cursor').card, env: fx.env, settingsFile: fx.settingsFile, pathDirs: [bin] }).ok, true);
});
