// The layout render in the command policy: brand.decide and interface.draw may run `starci work layout-render`, every other bound role
// may not, and an app server an op starts by hand is refused with the verb named (the verb is the one way an op gets a render).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadCommandPolicy, policyVerdict } from '../../scripts/guards/command-policy.mjs';
import { renderPromptLines } from '../../scripts/kernel/op-prompt-render.mjs';
import { buildOpPrompt } from '../../scripts/kernel/op-prompt.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const POLICY = loadCommandPolicy({ root: ROOT });
const opGuard = (op) => ({ schema: 'starci/op-guard@1', role: 'op', op });
const verbCommand = { program: 'starci', args: ['work', 'layout-render', '--work', '.starciwork', '--node', '/[locale]', '--breakpoint', 'desktop', '--theme', 'light', '--write'], cwd: ROOT };
const run = (command, op = 'brand.decide') => policyVerdict({ role: 'op', command: { cwd: ROOT, ...command }, guard: opGuard(op), policy: POLICY });



test('the named ops run the verb; any other op or bound role is refused with the verb as the use', () => {
  for (const op of POLICY.renders.layoutRender.ops) assert.equal(run(verbCommand, op), null, op);
  for (const op of ['backend.implement', 'interface.audit', 'unit.verify']) {
    const verdict = run(verbCommand, op);
    assert.equal(verdict?.code, 'RIGHTS_ROLE_DENIED', op);
    assert.match(verdict.reason, /only brand\.decide, interface\.draw call it/);
    assert.match(verdict.use, /starci work layout-render/);
  }
  for (const role of ['lead', 'coordinator']) assert.equal(policyVerdict({ role, command: { cwd: ROOT, ...verbCommand }, guard: null, policy: POLICY })?.code, 'RIGHTS_ROLE_DENIED', role);
});

test('a Supervisor or Kernel seat is outside the verb: its own seat table refuses first, the refusal still stops the verb and names the menu verb of that seat', () => {
  const seats = [
    { name: 'supervisor', role: 'supervisor', guard: null, code: 'SUPERVISOR_USE_DECIDE' },
    { name: 'kernel', role: 'lead', guard: { role: 'kernel', workflowId: 'wf-seat' }, code: 'KERNEL_USE_DECIDE' },
  ];
  for (const { name, role, guard, code } of seats) {
    const verdict = policyVerdict({ role, command: { cwd: ROOT, ...verbCommand }, guard, policy: POLICY });
    assert.equal(verdict?.code, code, name);
    assert.match(verdict.use, /decide/, name);
  }
});

test('a dev server started by hand is refused and the refusal names the verb, whichever way it is spelled', () => {
  const spellings = [
    { program: 'next', args: ['dev', '--hostname', '127.0.0.1', '--port', '3141'] },
    { program: 'npx', args: ['next', 'dev', '--port', '3141'] },
    { program: 'node', args: ['node_modules/next/dist/bin/next', 'dev', '--port', '3141'] },
    { program: 'node', args: [path.win32.join('node_modules', 'next', 'dist', 'bin', 'next'), 'dev'] },
    { program: 'npm', args: ['run', 'dev'] },
  ];
  for (const command of spellings) {
    const verdict = run(command);
    assert.equal(verdict?.code, 'RIGHTS_RAW_TOOL', JSON.stringify(command));
    assert.match(verdict.use, /starci work layout-render/, JSON.stringify(command));
  }
});

test('the verb adds no other permission: a plain node script is still refused with the generic use', () => {
  const verdict = run({ program: 'node', args: ['scripts/anything.mjs'] });
  assert.equal(verdict?.code, 'RIGHTS_RAW_TOOL');
  assert.doesNotMatch(verdict.use, /layout-render/);
  assert.equal(run({ program: 'starci', args: ['work', 'draw-render', 'x.html'] }, 'backend.implement'), null);
});

test('the op prompt of the two ops carries the verb line, naming the refusal code and its causes; no other op prompt does', () => {
  for (const op of POLICY.renders.layoutRender.ops) {
    const [line, ...rest] = renderPromptLines({ skillRoot: ROOT, op });
    assert.equal(rest.length, 0);
    assert.match(line, /starci work layout-render --work/);
    assert.match(line, /SHELL_RENDER_UNAVAILABLE/);
    assert.match(line, /never start next/);
  }
  assert.deepEqual(renderPromptLines({ skillRoot: ROOT, op: 'backend.implement' }), []);
  const prompt = (op) => buildOpPrompt({ skillRoot: ROOT, packet: { op, brief: `modules/ops/ops/${op}.yaml`, context: { records: [], owned_paths: [], attempt: 1 }, constraints: { model: 'm' } } });
  assert.match(prompt('brand.decide'), /starci-layout-render → starci work layout-render --work/);
  assert.doesNotMatch(prompt('backend.implement'), /starci work layout-render/);
});
