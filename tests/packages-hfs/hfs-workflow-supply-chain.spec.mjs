// C04: the managed CI templates retain supply-chain evidence in both editions without changing release triggers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { renderTargets } from '../../packages/hfs/sync/index.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST = loadSlotManifest();
const PRESETS = { sonarExclusions: [] };
const AUDIT = 'npm audit --omit=dev --audit-level=high';
const IMAGE_ARCHIVE = '${{ runner.temp }}/${{ matrix.name }}.oci.tar';

function workflows(edition) {
  const folder = edition === 'lite' ? 'lite-app' : 'shape-slot';
  const hfs = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', folder, 'hfs.json'), 'utf8'));
  const targets = renderTargets(hfs, PRESETS, { manifest: MANIFEST });
  return Object.fromEntries(['ci', 'images'].map(name => {
    const target = targets.find(candidate => candidate.path === `.github/workflows/${name}.yml`);
    assert.ok(target, `${edition} has the managed ${name} workflow`);
    return [name, parseYaml(target.content)];
  }));
}

function assertReleaseTrigger(workflow, events) {
  assert.deepEqual(Object.keys(workflow.on), events);
  assert.deepEqual(workflow.on.push.tags, ['v*']);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
}

function assertPinnedActions(workflow) {
  const actions = Object.values(workflow.jobs).flatMap(job => job.steps).filter(step => step.uses);
  assert.ok(actions.length > 0);
  for (const step of actions) assert.match(step.uses, /^[\w.-]+\/[\w./-]+@[a-f\d]{40}$/);
}

for (const edition of ['lite', 'full']) {
  test(`${edition} CI audits production dependencies before running checks`, () => {
    const { ci } = workflows(edition);
    const steps = ci.jobs.ci.steps;
    const install = steps.findIndex(step => step.run === 'npm ci --ignore-scripts');
    const audit = steps.findIndex(step => step.run === AUDIT);
    const lint = steps.findIndex(step => step.name === 'lint');
    assert.ok(install >= 0 && audit > install && lint > audit);
    assert.equal(steps[audit].if, undefined, 'a release always runs the audit');
    assert.equal(steps[audit]['continue-on-error'], undefined, 'audit failures fail CI');
    assertReleaseTrigger(ci, ['push', 'workflow_dispatch']);
    assertPinnedActions(ci);
  });

  test(`${edition} images retain an OCI archive with SBOM and provenance`, () => {
    const { images } = workflows(edition);
    const steps = images.jobs.image.steps;
    const buildIndex = steps.findIndex(step => step.uses?.startsWith('docker/build-push-action@'));
    const build = steps[buildIndex];
    const uploadIndex = steps.findIndex(step => step.uses?.startsWith('actions/upload-artifact@'));
    const upload = steps[uploadIndex];
    assert.ok(buildIndex >= 0 && uploadIndex > buildIndex);
    assert.equal(build.with.push, false);
    assert.equal(build.with.load, undefined, 'the classic Docker store would discard attestations');
    assert.equal(build.with.sbom, true);
    assert.equal(build.with.provenance, 'mode=max');
    assert.equal(build.with.outputs, `type=oci,dest=${IMAGE_ARCHIVE}`);
    assert.equal(upload.with.path, IMAGE_ARCHIVE);
    assert.equal(upload.with['if-no-files-found'], 'error');
    assert.match(upload.with.name, /matrix\.name/);
    assert.equal(upload.if, undefined, 'every built image retains its attestations');
    assert.equal(images.permissions.contents, 'read');
    assertReleaseTrigger(images, ['push']);
    assertPinnedActions(images);
  });
}
