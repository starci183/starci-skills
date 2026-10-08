// Drawing ops (interface.draw, interface.asset) and brand.decide take the tier of their difficulty (the imagegen tier is a call tier,
// modules/models/tiers.yaml tierUse), and the draw loop's critic is a different model from the drawer.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseYaml } from '../../engine/yaml.mjs';
import { hostToolsRequired, hostToolsOf } from '../../scripts/agent/models.mjs';
import { fakePoolSelection as selectPool } from '../helpers/fake-admission.mjs';
import { criticFor } from '../../scripts/work/critic-pick.mjs';
import { fakeAdmission } from '../helpers/fake-admission.mjs';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { withMachine } from '../../engine/db/machine.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const read = (rel) => parseYaml(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const registry = read('modules/models/registry.yaml');
const tiers = read('modules/models/tiers.yaml');
const runtimes = { ...read('modules/models/runtimes.yaml'), runtimes: registry.pools };

test('interface.draw takes the tier of its difficulty; the imagegen call tier is never an op tier', () => {
  assert.deepEqual(runtimes.roleOfKind['interface.draw'], { role: 'write', work: 'think', floor: 'hard' });
  assert.deepEqual(tiers.kindTiers, {});
  assert.deepEqual(tiers.tierUse, { imagegen: 'call' });
  assert.deepEqual(tiers.tiers.imagegen, [{ agent: 'codex', model: 'gpt-6.1-sol', effort: 'high' }]);
  for (const d of ['easy', 'medium', 'hard', 'insane']) {
    const r = selectPool({ kind: 'interface.draw', difficulty: d, runtimes, capacity: {} });
    assert.equal(r.tier, d === 'insane' ? 'frontier' : 'high', d);
    // The Playwright capture needs browser-dom, which Claude's card lacks: the chain is walked down to its Codex member.
    assert.deepEqual([r.target, r.modelId], ['codex-agent', 'gpt-6.1-sol'], d);
    const down = selectPool({ kind: 'interface.draw', difficulty: d, runtimes, capacity: { 'codex-agent': { auth: 'dead' } } });
    assert.ok(down.error && !down.target, `${d}: no browser-dom holder, no draw`);
  }
  assert.deepEqual(hostToolsRequired('interface.draw'), ['browser-dom']);
  assert.deepEqual(hostToolsRequired('interface.asset'), [], 'the asset op needs no image tool of its own agent: it calls starci work imagegen');
  assert.ok(hostToolsOf('devin').includes('browser-dom') && hostToolsOf('codex').includes('browser-dom'));
  assert.ok(registry.pools['devin-agent'].roles.includes('write'), 'the devin pool serves the draw kind role');
});

test('brand.decide and interface.asset take the high tier on Claude first; neither is seated on the image call tier', () => {
  assert.equal(tiers.kindTiers['brand.decide'], undefined, 'brand.decide is a decision op, not a drawing op');
  const b = selectPool({ kind: 'brand.decide', difficulty: 'medium', runtimes, capacity: {} });
  assert.deepEqual([b.tier, b.target, b.modelId, b.chain], ['high', 'claude-agent', 'claude-sonnet-5-5', ['claude/claude-sonnet-5-5', 'codex/gpt-6.1-sol']]);
  const down = selectPool({ kind: 'brand.decide', difficulty: 'hard', runtimes, capacity: { 'claude-agent': { auth: 'dead' } } });
  assert.deepEqual([down.target, down.modelId], ['codex-agent', 'gpt-6.1-sol']);
  const a = selectPool({ kind: 'interface.asset', difficulty: 'medium', runtimes, capacity: {} });
  assert.deepEqual([a.tier, a.target, a.chain], ['high', 'claude-agent', ['claude/claude-sonnet-5-5', 'codex/gpt-6.1-sol']]);
  const onCodex = selectPool({ kind: 'interface.asset', difficulty: 'medium', runtimes, capacity: { 'claude-agent': { auth: 'dead' } } });
  assert.deepEqual([onCodex.target, onCodex.modelId], ['codex-agent', 'gpt-6.1-sol']);
});

test('the route excludes unknown provider evidence and keeps eligible fallback models', (t) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-route-quota-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }));
  const stub = path.join(fixture, 'orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const env = { ...process.env, APPDATA: fixture, LOCALAPPDATA: fixture, STARCI_OWNER_ROOT: fixture,
    STARCI_TEST_MACHINE_FILE: path.join(fixture, 'machine.sqlite'), STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: path.join(fixture, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: path.join(fixture, 'state.json') };
  withMachine(() => {}, { env });
  const route = (kind) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'route', 'route-model.mjs'), '--kind', kind, '--json'], { cwd: ROOT, env, encoding: 'utf8', windowsHide: true });
  const draw = route('interface.draw');
  assert.equal(draw.status, 0, draw.stderr + draw.stdout);
  const decision = JSON.parse(draw.stdout);
  assert.equal(decision.tier, 'high');
  assert.equal(decision.pick.model, 'gpt-6.1-sol', 'the draw op needs browser-dom: Sol is the high member that holds it');
  assert.deepEqual(decision.fallbackChain, [], 'Claude is dropped by name for the missing host tool');
  const implement = JSON.parse(route('backend.implement').stdout);
  assert.equal(implement.tier, 'medium');
  assert.equal(implement.pick.model, 'gpt-6.1-sol', 'Devin has no verified quota here, so the medium tier falls to Codex');
  assert.ok(implement.admission.rejected.some((candidate) => candidate.provider === 'devin' && candidate.codes.includes('quota-unknown')));
  const brand = JSON.parse(route('brand.decide').stdout);
  assert.equal(brand.tier, 'high');
  assert.equal(brand.pick.model, 'claude-sonnet-5-5');
  assert.equal(brand.fallbackChain[0].model, 'gpt-6.1-sol');
});

test('the critic is another provider than the drawer, taken from its tier by the picker: Claude when Devin or Codex draws', async (t) => {
  const s = runtimes.allocation.drawLoop;
  assert.equal(s.critic, undefined, 'no critic is pinned by hand');
  assert.equal(criticFor(s, 'devin').critic.provider, 'claude');
  assert.equal(criticFor(s, 'devin').critic.tier, 'frontier');
  assert.match(criticFor(s, null).error, /unknown/);
  const alt = criticFor(s, 'codex');
  assert.equal(alt.critic.provider, 'claude');
  assert.equal(alt.critic.model, 'claude-opus-5-5');
  assert.ok(alt.critic.allowGroup.every((member) => member.provider !== 'codex'), "the drawer's provider is no candidate");
  const claudeOnly = criticFor(s, 'claude');
  assert.equal(claudeOnly.critic.provider, 'codex', 'a Claude drawer is judged by Codex');
  for (const c of [alt.critic, claudeOnly.critic]) assert.equal(c.command, undefined, 'a critic names its provider, never a CLI to spawn');
  // The loop resolves the drawer from the op its Orca terminal is bound to (guards/op-context.mjs): with a Devin op
  // on this terminal the critique the round writes names drawer 'devin' and a critic of another provider — no --drawer passed.
  const { withLedger, seedWorkflow } = await import('../helpers/ledger-fixture.mjs');
  const { guardsRoot } = await import('../../scripts/guards/guards-root.mjs');
  const { critiqueRound } = await import('../../scripts/work/draw-loop.mjs');
  await withLedger(t, async ({ repoRoot, ledger }) => {
    const handle = `term-draw-${process.pid}-${Date.now()}`;
    seedWorkflow(ledger, { id: 'wf-draw', jobs: [{ jobId: 'job-draw-1', opId: 'interface.draw', status: 'running',
      payload: { opId: 'interface.draw', owned_paths: ['x/'], managed: { agentTerminalHandle: handle } }, terminalHandle: handle }] });
    ledger.db.prepare("UPDATE op_attempts SET provider='devin' WHERE job_id='job-draw-1'").run();
    fs.mkdirSync(path.join(guardsRoot(), 'terminals'), { recursive: true });
    fs.writeFileSync(path.join(guardsRoot(), 'terminals', `${handle}.json`),
      JSON.stringify({ schema: 'starci/op-guard@1', role: 'op', terminal: handle, jobId: 'job-draw-1', workflowId: 'wf-draw', ledgerRepo: repoRoot }));
    const saved = process.env.ORCA_TERMINAL_HANDLE;
    process.env.ORCA_TERMINAL_HANDLE = handle;
    t.after(() => { if (saved === undefined) delete process.env.ORCA_TERMINAL_HANDLE; else process.env.ORCA_TERMINAL_HANDLE = saved; });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-critique-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
    const html = path.join(dir, 'screen.html');
    fs.writeFileSync(html, '<p>x</p>');
    const started = [];
    const critique = await critiqueRound({ loop: {}, n: 1, roundDir: dir, captures: [], html, settings: s, orca: {
      admission: fakeAdmission(),
      criticWorkspace: () => ({ ok: true, dir }), removeCriticWorkspace: () => ({ ok: true }),
      runCreate: () => ({ ok: true, runId: 'run-critic' }), runShow: () => ({ ok: false, error: 'none' }), workerList: () => ({ ok: true, workers: [] }),
      trust: () => ({ ok: true }), terminalRename: () => ({ ok: true }), workerShow: () => ({ ok: false, error: 'none' }),
      workerStart: (o) => { started.push(o); return { ok: false, error: 'no critic worker in a spec' }; },
      workerStop: () => ({ ok: true }), workerRelease: () => ({ ok: true }),
    } });
    assert.equal(critique.critic.drawer, 'devin', 'the bound op\'s provider is the drawer');
    assert.equal(critique.critic.provider, 'claude', 'the critic is a different provider than the drawer');
    assert.equal(started[0]?.agent, 'claude', 'the worker-start launch routes the critic to the tier member of another provider');
    assert.equal(critique.outcome, 'launch-failed', 'the fake Orca never launches a real critic');
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'critique.json'), 'utf8')).critic.drawer, 'devin', 'written to the round');
  });
});
