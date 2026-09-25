import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseYaml } from '../engine/yaml.mjs';
import { resolveOpParams } from '../scripts/route/dispatch-op.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = rel => parseYaml(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

test('workspace.manage owns the .starcistacks tree through its stacks mode', () => {
  const op = read('modules/ops/ops/workspace.manage.yaml');
  const stacks = op.policy.executionModes.stacks;
  assert.ok(stacks, 'stacks execution mode declared');
  const writes = stacks.writes.map(w => w.path);
  assert.ok(writes.includes('.starcistacks/application-stacks.yaml'));
  assert.ok(writes.includes('.starcistacks/<environment>/**'));
  const layoutDoc = read('modules/schemas/stacks-layout.yaml');
  assert.equal(layoutDoc.declaration, '.starcistacks/application-stacks.yaml', 'the declaration path is the layout contract');
  const readPaths = stacks.reads.map(r => r.path).join('\n');
  for (const cite of ['modules/schemas/stacks-layout.yaml', 'knowledge/application-stacks.yaml', '{sds,contract,integration}']) {
    assert.ok(readPaths.includes(cite), `stacks mode reads ${cite}`);
  }
  const proof = stacks.proofs.find(p => p.id === 'stacks-conformant');
  assert.ok(proof && fs.existsSync(path.join(ROOT, proof.check)), 'the proof cites the stacks check on disk');
  assert.match(proof.requirement.en, /stacks check/);
});

test('the stacks mode is a kernel-set param: the kernel may select it, a goal leg may not', () => {
  const op = read('modules/ops/ops/workspace.manage.yaml');
  assert.deepEqual(op.params.mode.enum, ['select', 'prepare', 'import', 'stacks']);
  assert.equal(resolveOpParams(op, {}).params.mode, 'select');
  assert.equal(resolveOpParams(op, { flag: { mode: 'stacks' } }).params.mode, 'stacks');
  assert.equal(resolveOpParams(op, { leg: { mode: 'stacks' } }).ok, false);
  assert.equal(resolveOpParams(op, { flag: { mode: 'deploy' } }).ok, false);
});

test('spec-foundation names the stacks mode as a hard leg in the plan', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'route', 'route-plan.mjs'),
    '--text', 'viết SDS và khai báo .starcistacks cho mọi feature', '--json'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const plan = JSON.parse(r.stdout);
  const leg = plan.legs.find(l => l.op === 'workspace.manage' && l.instance === 'stacks');
  assert.ok(leg, 'workspace.manage#stacks leg');
  assert.match(leg.injected, /params\.mode=stacks/);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-stacks-plan-'));
  try {
    const d = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'goal', 'define-goal.mjs'), '--repo', tmp,
      '--text', 'viết SDS và khai báo .starcistacks cho mọi feature', '--plan', '--json'], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(d.status, 0, d.stderr);
    const out = JSON.parse(d.stdout);
    assert.equal(out.legs.find(l => l.op === 'workspace.manage#stacks')?.tier, 'hard');
    assert.equal(out.legs.find(l => l.op === 'workspace.manage')?.tier, 'easy');
    assert.ok(!fs.existsSync(path.join(tmp, '.starciwork')), '--plan writes nothing');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

for (const op of ['backend.scaffold', 'interface.scaffold']) {
  test(`${op} expects an absent implementation record on greenfield and creates only its own`, () => {
    const manifest = read(`modules/ops/ops/${op}.yaml`);
    const target = manifest.reads.find(r => r.id === 'target');
    assert.doesNotMatch(target.purpose.en, /gap/i, 'absence is not reported as a scope gap');
    assert.match(target.purpose.en, /greenfield/);
    const creating = manifest.steps.filter(s => /create only that selected implementation scope/.test(s.action.en));
    assert.equal(creating.length, 1, 'one step creates only the selected scope record');
    assert.ok(creating[0].reads.includes('target'));
    assert.ok(creating[0].writes.includes('node'));
  });
}

test('every mode op takes its mode as params.mode, and dispatch digests that mode\'s reads', async () => {
  const { opInputPaths } = await import('../scripts/kernel/input-digests.mjs');
  const dir = path.join(ROOT, 'modules', 'ops', 'ops');
  const modeOps = fs.readdirSync(dir).filter(f => f.endsWith('.yaml')).map(f => read(`modules/ops/ops/${f}`)).filter(op => op.policy?.executionModes);
  assert.deepEqual(modeOps.map(op => op.id).sort(), ['release.deliver', 'review.verify', 'runtime.operate', 'workspace.manage']);
  for (const op of modeOps) {
    const modes = Object.keys(op.policy.executionModes);
    assert.equal(op.params?.mode?.setBy, 'kernel', `${op.id} declares params.mode set by the kernel`);
    for (const mode of modes) {
      const resolved = resolveOpParams(op, { flag: { mode } });
      assert.equal(resolved.ok, true, `${op.id} --params mode=${mode}: ${resolved.detail ?? ''}`);
      const bound = opInputPaths(op, { params: resolved.params, mode: resolved.params.mode });
      const modeOnly = opInputPaths({ policy: op.policy }, { mode });
      for (const input of modeOnly) assert.ok(bound.includes(input), `${op.id} mode ${mode} digests ${input}`);
    }
  }
  const lint = read('modules/ops/ops/review.verify.yaml');
  assert.ok(opInputPaths({ policy: lint.policy }, { mode: 'lint' }).length, 'the lint mode reads Source law the digest must bind');
});

test('driver-loop tells the kernel to enqueue a mode op with --params mode', () => {
  const loop = read('modules/kernel/driver-loop.yaml');
  const modeOps = String(loop.tick?.enqueue?.modeOps ?? '');
  assert.match(modeOps, /--params '\{"mode"/, 'enqueue.modeOps names the --params mode flag');
  for (const op of ['release.deliver', 'review.verify', 'runtime.operate', 'workspace.manage'])
    assert.ok(modeOps.includes(op), `enqueue.modeOps names ${op}`);
  assert.match(modeOps, /executionModes\.<mode>\.reads/, 'the reason is the mode digest dispatch binds');
});

test('the mode ops share one selector envelope: no union of mode permissions, exactly one mode', () => {
  const ids = ['release.deliver', 'review.verify', 'runtime.operate', 'workspace.manage'];
  const envelope = (op) => ({
    sideEffects: op.sideEffects,
    graphPolicy: op.graphPolicy,
    modePolicy: { selection: op.policy.modePolicy.selection, implicitChain: op.policy.modePolicy.implicitChain, permissionUnion: op.policy.modePolicy.permissionUnion, completion: op.policy.modePolicy.completion },
    selection: op.reads.find((r) => r.id === 'selection'),
    operationRequired: op.blockers.find((b) => b.code === 'OPERATION_REQUIRED'),
  });
  const [first, ...rest] = ids.map((id) => envelope(read(`modules/ops/ops/${id}.yaml`)));
  assert.equal(first.modePolicy.permissionUnion, false);
  assert.equal(first.modePolicy.selection, 'required-exactly-one');
  rest.forEach((other, i) => assert.deepEqual(other, first, `${ids[i + 1]} carries the ${ids[0]} selector envelope`));
});
