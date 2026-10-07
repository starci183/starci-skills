// The imagegen call in the command policy: the three drawing ops may run `starci work imagegen`, every other bound role may not,
// and a hand-run `codex exec` stays refused for all of them (the verb is the one headless way an op gets an image).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadCommandPolicy, policyVerdict } from '../../scripts/guards/command-policy.mjs';
import { launchVerdict } from '../../scripts/guards/launch-verdict.mjs';
import { imagegenPromptLines } from '../../scripts/kernel/op-prompt-imagegen.mjs';
import { buildOpPrompt } from '../../scripts/kernel/op-prompt.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const POLICY = loadCommandPolicy({ root: ROOT });
const verbCommand = { program: 'starci', args: ['work', 'imagegen', '--prompt', 'p.txt', '--out', 'assets', '--json'], cwd: ROOT };
const opGuard = (op) => ({ schema: 'starci/op-guard@1', role: 'op', op });

test('the policy table names the drawing ops and the verb', () => {
  assert.deepEqual(POLICY.calls.imagegen.verb, ['work', 'imagegen']);
  assert.deepEqual(POLICY.calls.imagegen.ops, ['interface.draw', 'interface.asset', 'brand.decide']);
});

test('interface.draw, interface.asset and brand.decide may run the verb', () => {
  for (const op of POLICY.calls.imagegen.ops) assert.equal(policyVerdict({ role: 'op', command: verbCommand, guard: opGuard(op), policy: POLICY }), null, op);
});

test('every other op and every other bound role is refused the verb with the verb named as the use', () => {
  for (const op of ['backend.implement', 'interface.audit', 'uat.verify', 'unit.verify']) {
    const verdict = policyVerdict({ role: 'op', command: verbCommand, guard: opGuard(op), policy: POLICY });
    assert.equal(verdict?.code, 'RIGHTS_ROLE_DENIED', op);
    assert.match(verdict.reason, /only interface\.draw, interface\.asset, brand\.decide call it/);
    assert.match(verdict.use, /starci work imagegen/);
  }
  for (const role of ['lead', 'supervisor', 'coordinator']) {
    assert.equal(policyVerdict({ role, command: verbCommand, guard: null, policy: POLICY })?.code, 'RIGHTS_ROLE_DENIED', role);
  }
});

test('the verb adds no other starci permission: its neighbours pass or fail exactly as before', () => {
  const run = (args, op = 'backend.implement') => policyVerdict({ role: 'op', command: { program: 'starci', args, cwd: ROOT }, guard: opGuard(op), policy: POLICY });
  assert.equal(run(['work', 'draw-render', 'x.html']), null);
  assert.equal(run(['work', 'asset-slot', 'list', '.starciwork']), null);
  assert.equal(run(['gate', 'unit']), null);
});

test('a hand-run codex exec is refused for the drawing ops too, and the refusal points at the verb', () => {
  for (const op of POLICY.calls.imagegen.ops) {
    const raw = policyVerdict({ role: 'op', command: { program: 'codex', args: ['exec', '--json', '-'], cwd: ROOT }, guard: opGuard(op), policy: POLICY });
    assert.equal(raw?.code, 'RIGHTS_RAW_TOOL', op);
  }
  const launch = launchVerdict('codex', ['exec', '-m', 'gpt-6.1-sol', 'draw a mascot'], opGuard('interface.asset'));
  assert.equal(launch.code, 'AGENT_HEADLESS_LAUNCH');
  assert.match(launch.remedy, /starci work imagegen/);
  assert.doesNotMatch(launchVerdict('claude', ['-p', 'x'], opGuard('interface.asset')).remedy, /imagegen/);
});

test('the op prompt tells exactly the three ops how to get an image and names the refusal codes', () => {
  for (const op of POLICY.calls.imagegen.ops) {
    const [line, ...rest] = imagegenPromptLines({ skillRoot: ROOT, op });
    assert.equal(rest.length, 0);
    assert.match(line, /starci work imagegen --prompt/);
    assert.match(line, /IMAGEGEN_QUOTA/);
    assert.match(line, /never replace the image with a hand-made/);
  }
  for (const op of ['backend.implement', 'interface.audit']) assert.deepEqual(imagegenPromptLines({ skillRoot: ROOT, op }), [], op);
});

test('the built [Op] prompt of the three drawing ops carries the verb line and no other op prompt does', () => {
  const prompt = (op) => buildOpPrompt({ skillRoot: ROOT, packet: { op, brief: `modules/ops/ops/${op}.yaml`, context: { records: [], owned_paths: [], attempt: 1 }, constraints: { model: 'm' } } });
  for (const op of POLICY.calls.imagegen.ops) assert.match(prompt(op), /starci-imagegen → starci work imagegen --prompt/, op);
  assert.doesNotMatch(prompt('backend.implement'), /starci work imagegen/);
});
