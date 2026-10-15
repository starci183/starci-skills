// The full starter must carry reviewable release/recovery declarations before its first deployment.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { stacksSwarmFindings } from '../../scripts/hfs/rules/stacks-swarm.mjs';
import { stacksIngressFindings } from '../../scripts/hfs/rules/stacks-ingress.mjs';
import { stacksReleaseFindings } from '../../scripts/hfs/rules/stacks-release.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const TEMPLATE = fileURLToPath(new URL('../../packages/hfs/templates/app/skeleton/.starcistacks/', import.meta.url));
const PREFIX = '.starcistacks/production/infra/swarm/';

function materialize(t) {
  const repoRoot = mkdtemp(t, 'hfs-full-stack-template-');
  const files = [];
  for (const entry of fs.readdirSync(TEMPLATE, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    assert.ok(!entry.name.endsWith('.enc'), 'runtime templates contain no sealed members');
    const source = path.join(entry.parentPath, entry.name);
    const relative = path.relative(TEMPLATE, source).split(path.sep).join('/');
    const file = `.starcistacks/${relative}`;
    const target = path.join(repoRoot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const text = fs.readFileSync(source, 'utf8').replaceAll('{{project}}', 'demo').replaceAll('{{sonarGate}}', 'demo-gate');
    fs.writeFileSync(target, text);
    files.push(file);
  }
  return { repoRoot, files, isRoot: true, repo: { profile: 'app', edition: 'full' } };
}

function yaml(context, file) {
  const text = fs.readFileSync(path.join(context.repoRoot, file), 'utf8');
  assert.ok(!text.trimStart().startsWith('{'), `${file} is authored YAML`);
  return parseYaml(text);
}

test('full starter declares safe Swarm ingress, versioned custody and tracked release/recovery records', (t) => {
  const context = materialize(t);
  assert.deepEqual(stacksSwarmFindings(context), []);
  assert.deepEqual(stacksIngressFindings(context), []);
  assert.deepEqual(stacksReleaseFindings(context), []);
  const manifest = yaml(context, '.starcistacks/application-stacks.yaml');
  const model = yaml(context, `${PREFIX}stack.yaml`);
  const lock = yaml(context, `${PREFIX}releases/images.lock.yaml`);
  assert.equal(lock.status, 'pending-owner-release');
  for (const [id, image] of Object.entries(lock.images)) {
    assert.equal(image, model.services[id].image);
    assert.equal(image, manifest.components[id].image);
  }
  assert.deepEqual(manifest.environments.production.backup.map((entry) => entry.component), ['ingress', 'primary']);
  for (const [name, status] of [['current', 'pending-owner-release'], ['previous', 'no-previous-release']]) {
    const pointer = yaml(context, `${PREFIX}releases/${name}.yaml`);
    assert.equal(pointer.status, status);
    assert.equal(pointer.release, null);
    assert.equal(pointer.verification, null);
  }
  const proof = fs.readFileSync(path.join(context.repoRoot, `${PREFIX}recovery/restore-proof.md`), 'utf8');
  assert.match(proof, /pending owner execution/);
  assert.match(proof, /No backup or restore has been run/);
});
