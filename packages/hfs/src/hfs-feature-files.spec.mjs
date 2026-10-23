// proves: HFS_FEATURE_FILE_BUDGET@lite
// proves: HFS_FEATURE_FILE_BUDGET@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../runtime/scripts/hfs/check.mjs';
import { loadSlotManifest, resolveRepoDeclaration, createSlotResolver } from '../runtime/scripts/hfs/slots.mjs';
import { featureFileFindings } from '../runtime/scripts/hfs/rules/feature-files.mjs';
import { a15Findings } from '../runtime/scripts/hfs/rules/a15-findings.mjs';

/** An empty directory standing for the app root: the check judges the listed files, never the disk tree. */
const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-feature-files-'));
test.after(() => fs.rmSync(appRoot, { recursive: true, force: true }));

const manifest = loadSlotManifest();
const declaration = (edition) => ({
  hfs: 3, kind: 'app', project: 'budget', edition,
  sides: {
    be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }] },
    fe: { apps: [{ name: 'web', kind: 'next' }] },
  },
});
const context = (profile, edition, files, customManifest = manifest) => {
  const repo = resolveRepoDeclaration(customManifest, declaration(edition), { side: profile });
  return { files, all: files, repo, manifest: customManifest, resolver: createSlotResolver(customManifest, repo), isRoot: false, inScope: () => true };
};
const entries = (root, count) => Array.from({ length: count }, (_, index) => `${root}/application/item-${index}.input.ts`);
const beRoot = 'src/features/api/orders';
const feRoot = 'apps/web/src/features/pages/Orders';

for (const edition of ['lite', 'full']) {
  test(`HFS_FEATURE_FILE_BUDGET: ${edition} rejects 251 files in a BE or FE feature`, () => {
    for (const [profile, root] of [['be', beRoot], ['fe', feRoot]]) {
      const findings = featureFileFindings(context(profile, edition, entries(root, 251)));
      assert.equal(findings.length, 1);
      assert.equal(findings[0].code, 'HFS_FEATURE_FILE_BUDGET');
      assert.equal(findings[0].level, 'error');
      assert.equal(findings[0].path, root);
      assert.equal(findings[0].files, 251);
      assert.equal(findings[0].max, 250);
      assert.match(findings[0].message, /251 tracked files.*250/);
    }
  });

  test(`HFS_FEATURE_FILE_BUDGET: ${edition} accepts 250 files and independent smaller features`, () => {
    for (const [profile, root, other] of [['be', beRoot, 'src/features/api/billing'], ['fe', feRoot, 'apps/web/src/features/pages/Billing']]) {
      const files = [...entries(root, 250), ...entries(other, 250)];
      assert.deepEqual(featureFileFindings(context(profile, edition, files)), []);
    }
  });

  test(`HFS_FEATURE_FILE_BUDGET: ${edition} applies the edition's ruleParams instead of a fixed limit`, () => {
    const custom = structuredClone(manifest);
    custom.ruleParams.common.featureFiles = 4;
    custom.ruleParams.be.lite = { ...custom.ruleParams.be.lite, featureFiles: 2 };
    const max = edition === 'lite' ? 2 : 4;
    assert.deepEqual(featureFileFindings(context('be', edition, entries(beRoot, max), custom)), []);
    assert.equal(featureFileFindings(context('be', edition, entries(beRoot, max + 1), custom))[0].max, max);
    assert.deepEqual(featureFileFindings(context('fe', edition, entries(feRoot, 4), custom)), []);
    assert.equal(featureFileFindings(context('fe', edition, entries(feRoot, 5), custom))[0].max, 4);
  });

  test(`HFS_FEATURE_FILE_BUDGET: ${edition} wiring reports app-relative findings once with catalog explanations`, () => {
    const files = [...entries(beRoot, 251).map((file) => `be/${file}`), ...entries(feRoot, 251).map((file) => `fe/${file}`)];
    const result = checkRepo({ repoRoot: appRoot, declaration: declaration(edition), files, tree: false });
    const findings = result.findings.filter((finding) => finding.code === 'HFS_FEATURE_FILE_BUDGET');
    assert.deepEqual(findings.map((finding) => finding.path), [`be/${beRoot}`, `fe/${feRoot}`]);
    assert.ok(findings.every((finding) => finding.title && finding.titleVi && finding.whyVi && finding.nextStepVi));
  });
}

test('HFS_FEATURE_FILE_BUDGET: every BE trigger owner and FE feature kind is counted separately', () => {
  const beRoots = ['api/orders', 'jobs/daily', 'reactors/billed', 'saga/checkout', 'webhooks/provider', 'realtime/orders', 'cli'].map((root) => `src/features/${root}`);
  const feRoots = ['pages/Orders', 'layouts/Shell', 'overlays/Checkout'].map((root) => `apps/web/src/features/${root}`);
  assert.deepEqual(featureFileFindings(context('be', 'full', beRoots.flatMap((root) => entries(root, 251)))).map((finding) => finding.path), beRoots);
  assert.deepEqual(featureFileFindings(context('fe', 'full', feRoots.flatMap((root) => entries(root, 251)))).map((finding) => finding.path), feRoots);
});

test('HFS_FEATURE_FILE_BUDGET: nested files, specs and non-source files count; path aliases do not count twice', () => {
  const files = [...entries(beRoot, 248), `${beRoot}/transport/graphql/order.resolver.ts`, `${beRoot}/application/order.service.spec.ts`, `${beRoot}/README.md`];
  const aliases = [...files, files[0], `./${files[0]}`, files[0].replaceAll('/', '\\')];
  const findings = featureFileFindings(context('be', 'lite', aliases));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].files, 251);
  assert.deepEqual(featureFileFindings(context('be', 'lite', aliases.filter((file) => !file.endsWith('README.md')))), []);
});

test('HFS_FEATURE_FILE_BUDGET: complete tree count survives a scoped file check', () => {
  const all = entries(beRoot, 251);
  const ctx = { ...context('be', 'full', all.slice(0, 1)), all, inScope: (file) => file === all[0] };
  assert.equal(featureFileFindings(ctx)[0].files, 251);
});

test('HFS_FEATURE_FILE_BUDGET: modules, component providers and files outside features have no feature budget', () => {
  const beFiles = entries('src/modules/domain/orders', 251);
  const feFiles = entries('apps/web/src/components/providers/Auth', 251);
  assert.deepEqual(featureFileFindings(context('be', 'full', beFiles)), []);
  assert.deepEqual(featureFileFindings(context('fe', 'full', feFiles)), []);
});

test('HFS_FEATURE_FILE_BUDGET: app root delegates to its side invocations and an empty feature passes', () => {
  const repo = resolveRepoDeclaration(manifest, declaration('lite'));
  assert.deepEqual(featureFileFindings({ repo, files: entries(`be/${beRoot}`, 251), resolver: createSlotResolver(manifest, repo), isRoot: true }), []);
  assert.deepEqual(a15Findings(context('be', 'lite', [])).filter((finding) => finding.code === 'HFS_FEATURE_FILE_BUDGET'), []);
});

test('HFS_FEATURE_FILE_BUDGET: the published runtime carries the finder and its failure explanation', async () => {
  const bundled = await import('../runtime/scripts/hfs/check.mjs');
  for (const edition of ['lite', 'full']) {
    const files = entries(beRoot, 251).map((file) => `be/${file}`);
    const result = bundled.checkRepo({ repoRoot: appRoot, declaration: declaration(edition), files, tree: false });
    const findings = result.findings.filter((finding) => finding.code === 'HFS_FEATURE_FILE_BUDGET');
    assert.equal(findings.length, 1);
    assert.equal(findings[0].path, `be/${beRoot}`);
    assert.ok(findings[0].titleVi && findings[0].nextStepVi);
  }
});
