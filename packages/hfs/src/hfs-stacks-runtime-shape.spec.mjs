// proves: HFS_STACKS_SHAPE@lite
// proves: HFS_STACKS_SHAPE@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { stacksRuntimeFindings } from '../runtime/scripts/hfs/rules/stacks-runtime.mjs';
import { checkApplicationStacks, trackedStacksGateFindings } from '../runtime/scripts/hfs/stacks-gate.mjs';
import { applicationStackFindings } from '../runtime/scripts/hfs/starcistacks-runtime.mjs';
import { checkStarciStacks } from '../runtime/scripts/gates/starcistacks.mjs';
import { swarmFixture } from './helpers/swarm-stack-fixture.mjs';

const code = 'HFS_STACKS_SHAPE';
function runtimeContext(fixture, edition) {
  return { repoRoot: fixture.root, files: [...fixture.files], all: [...fixture.files],
    repo: { profile: 'app', edition }, isRoot: true };
}

function runtimeInput(fixture, edition) {
  return { repoRoot: fixture.root, files: [...fixture.files], doc: fixture.manifest, edition };
}

for (const edition of ['lite', 'full']) {
  test(`${code} ${edition}: accepts pinned Swarm runtime through the app and stack gates`, t => {
    const fixture = swarmFixture(t, edition);
    assert.deepEqual(stacksRuntimeFindings(runtimeInput(fixture, edition)), []);
    assert.deepEqual(applicationStackFindings(fixture.root), []);
    assert.deepEqual(checkApplicationStacks({ repoRoot: fixture.root, environment: 'production',
      deploymentModelFile: fixture.modelFile, repo: { edition } }).errors.filter(item => item.code === code), []);
    assert.deepEqual(trackedStacksGateFindings(runtimeContext(fixture, edition)).filter(item => item.code === code), []);
    assert.deepEqual(checkStarciStacks(fixture.root).findings.filter(item => item.code === code), []);
  });

  test(`${code} ${edition}: rejects an unpinned Swarm image through the app and stack gates`, t => {
    const fixture = swarmFixture(t, edition);
    fixture.model.services.api.image = 'registry.example.org/app:latest';
    fixture.write();
    assert.ok(stacksRuntimeFindings(runtimeInput(fixture, edition)).some(item => item.code === code));
    assert.ok(applicationStackFindings(fixture.root).some(item => item.code === code));
    assert.ok(checkApplicationStacks({ repoRoot: fixture.root, environment: 'production',
      deploymentModelFile: fixture.modelFile, repo: { edition } }).errors.some(item => item.code === code));
    assert.ok(trackedStacksGateFindings(runtimeContext(fixture, edition)).some(item => item.code === code));
    assert.ok(checkStarciStacks(fixture.root).findings.some(item => item.code === code));
  });
}
