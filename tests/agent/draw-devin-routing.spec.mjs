// Owner ruling 2026-09-27 (modules/kernel/owner-rulings.yaml draw-devin-brand-claude): interface.draw is drawn by
// Devin (Codex the fallback), brand.decide is decided by Claude (Codex the fallback), interface.asset keeps the Codex
// image tool, and the draw loop's critic is a different model from the drawer.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseYaml } from '../../engine/yaml.mjs';
import { selectPool, hostToolsRequired, hostToolsOf } from '../../scripts/agent/models.mjs';
import { criticFor } from '../../scripts/work/draw-critic.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const read = (rel) => parseYaml(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const registry = read('modules/models/registry.yaml');
const runtimes = { ...read('modules/models/runtimes.yaml'), runtimes: registry.pools };

test('interface.draw walks the draw order: Devin first, Codex the fallback', () => {
  assert.deepEqual(runtimes.roleOfKind['interface.draw'], { role: 'write', work: 'think', floor: 'hard', order: 'draw' });
  assert.deepEqual(runtimes.allocation.preference.draw, ['devin-agent', 'codex-agent']);
  for (const tier of ['hard', 'medium']) assert.deepEqual(runtimes.allocation.tiers[tier].draw, ['devin-agent', 'codex-agent'], tier);
  for (const tier of ['easy', 'insane']) assert.deepEqual(runtimes.allocation.tiers[tier].draw, ['codex-agent'], `${tier}: Devin pins no model there`);
  assert.deepEqual(registry.operators['interface.draw'].chain, ['devin-agent', 'codex-agent']);
  for (const d of ['medium', 'hard']) {
    const r = selectPool({ kind: 'interface.draw', difficulty: d, runtimes });
    assert.deepEqual([r.target, r.modelId, r.chain, r.order], ['devin-agent', 'swe-2-max', ['devin-agent', 'codex-agent'], 'draw'], d);
    const down = selectPool({ kind: 'interface.draw', difficulty: d, runtimes, capacity: { 'devin-agent': { auth: 'dead' } } });
    assert.deepEqual([down.target, down.modelId], ['codex-agent', 'gpt-6-sol'], `${d}: Codex Sol when Devin cannot`);
  }
  // Devin runs Playwright in product checkouts: the manifest's browser-dom host tool is on its card.
  assert.deepEqual(hostToolsRequired('interface.draw'), ['browser-dom']);
  assert.ok(hostToolsOf('devin').includes('browser-dom') && hostToolsOf('codex').includes('browser-dom'));
  assert.ok(registry.pools['devin-agent'].roles.includes('write'), 'the devin pool serves the draw kind role');
});

test('brand.decide walks the brand order: Claude first, Codex the fallback; interface.asset keeps the Codex image tool', () => {
  assert.equal(runtimes.roleOfKind['brand.decide'].order, 'brand');
  for (const tier of Object.keys(runtimes.allocation.tiers)) assert.deepEqual(runtimes.allocation.tiers[tier].brand, ['claude-agent', 'codex-agent'], tier);
  const b = selectPool({ kind: 'brand.decide', difficulty: 'medium', runtimes });
  assert.deepEqual([b.target, b.modelId, b.order], ['claude-agent', 'claude-opus-5-5', 'brand']);
  assert.equal(selectPool({ kind: 'brand.decide', difficulty: 'hard', runtimes, capacity: { 'claude-agent': { auth: 'dead' } } }).target, 'codex-agent');
  assert.deepEqual(registry.operators['brand.decide'].chain, ['claude-agent', 'codex-agent']);
  assert.equal(runtimes.roleOfKind['interface.asset'].order, 'asset');
  const a = selectPool({ kind: 'interface.asset', difficulty: 'medium', runtimes });
  assert.deepEqual([a.target, a.chain], ['codex-agent', ['codex-agent']]);
  assert.ok(selectPool({ kind: 'interface.asset', difficulty: 'medium', runtimes, capacity: { 'codex-agent': { auth: 'dead' } } }).error, 'no image tool, no asset');
});

test('the dry route prints the same picks (route-model.mjs)', () => {
  const route = (kind) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'route', 'route-model.mjs'), '--kind', kind], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
  const draw = route('interface.draw');
  assert.equal(draw.status, 0, draw.stderr);
  assert.match(draw.stdout, /PICK devin-agent\s+model=swe-2-max/);
  assert.match(draw.stdout, /-> codex-agent \(gpt-6-sol\)/);
  assert.match(route('brand.decide').stdout, /PICK claude-agent\s+model=claude-opus-5-5[\s\S]*-> codex-agent/);
});

test('the critic is a different model from the drawer: Codex when Devin draws, Claude when Codex draws', () => {
  const s = runtimes.allocation.drawLoop;
  assert.equal(s.critic.provider, 'codex');
  assert.equal(criticFor(s, 'devin').critic.provider, 'codex');
  assert.equal(criticFor(s, null).critic.provider, 'codex');
  const alt = criticFor(s, 'codex');
  assert.equal(alt.critic.provider, 'claude');
  assert.notEqual(alt.critic.provider, 'codex');
  assert.match(criticFor({ critic: s.critic }, 'codex').error, /different model from the drawer/);
  assert.equal(alt.critic.model, 'claude-opus-5-5');
  for (const c of [s.critic, alt.critic]) assert.equal(c.command, undefined, 'a critic names its provider, never a CLI to spawn');
  const loop = fs.readFileSync(path.join(ROOT, 'scripts', 'work', 'draw-loop.mjs'), 'utf8');
  assert.match(loop, /opContextOf\(\)\?\.provider/, 'the loop knows the drawer from the op its Orca terminal is bound to');
});
