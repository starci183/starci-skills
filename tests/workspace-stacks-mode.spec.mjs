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
