// proves: BE_KIND_DECLARATION@lite
// proves: BE_KIND_DECLARATION@full
// proves: BE_KIND_EMPTY@lite
// proves: BE_KIND_EMPTY@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { kindFindings } from '../../scripts/hfs/rules/kinds.mjs';

const api = ['be/src/features/api/orders/index.ts', 'be/src/features/api/orders/orders.module.ts'];
const job = ['be/src/features/jobs/send/index.ts', 'be/src/features/jobs/send/transport/queue/send.processor.ts'];
const platform = ['be/src/modules/platform/jobs/index.ts', 'be/src/modules/platform/queue/index.ts'];
const declaration = { kinds: ['api', 'jobs'], patterns: ['fenced-job', 'queue'] };
const context = (edition, files, be) => ({ files, repo: { edition, sides: { be } } });

for (const edition of ['lite', 'full']) {
  test(`${edition} BE_KIND_DECLARATION rejects an undeclared kind and an unused declaration`, () => {
    const undeclared = kindFindings(context(edition, [...api, ...job, ...platform], {
      kinds: ['api'], patterns: ['fenced-job', 'queue'],
    }));
    assert.deepEqual(undeclared.map((finding) => finding.code), ['BE_KIND_DECLARATION']);
    assert.equal(undeclared[0].kind, 'jobs');
    const unused = kindFindings(context(edition, api, { kinds: ['api', 'reactors'] }));
    assert.deepEqual(unused.map((finding) => finding.code), ['BE_KIND_DECLARATION']);
    assert.match(unused[0].message, /no feature of that kind exists/);
  });

  test(`${edition} BE_KIND_DECLARATION rejects missing patterns and platform capabilities`, () => {
    const missingPattern = kindFindings(context(edition, [...api, ...job, ...platform], {
      kinds: ['api', 'jobs'], patterns: ['queue'],
    }));
    assert.deepEqual(missingPattern.map((finding) => finding.code), ['BE_KIND_DECLARATION']);
    assert.equal(missingPattern[0].pattern, 'fenced-job');
    const missingCapability = kindFindings(context(edition, [...api, ...job, platform[1]], declaration));
    assert.deepEqual(missingCapability.map((finding) => finding.code), ['BE_KIND_DECLARATION']);
    assert.equal(missingCapability[0].capability, 'jobs');
  });

  test(`${edition} BE_KIND_DECLARATION accepts used kinds with their declared patterns and tracked capabilities`, () => {
    assert.deepEqual(kindFindings(context(edition, [...api, ...job, ...platform], declaration)), []);
    assert.deepEqual(kindFindings(context(edition, api, { kinds: ['api'] })), []);
  });

  test(`${edition} BE_KIND_EMPTY rejects a file directly in a kind folder`, () => {
    const findings = kindFindings(context(edition, [...api, 'be/src/features/jobs/.gitkeep'], { kinds: ['api'] }));
    assert.deepEqual(findings.map((finding) => finding.code), ['BE_KIND_EMPTY']);
    assert.equal(findings[0].path, 'be/src/features/jobs/.gitkeep');
  });

  test(`${edition} BE_KIND_EMPTY rejects a kind member without TypeScript source`, () => {
    const files = [...api, 'be/src/features/jobs/send/README.md', ...platform];
    const findings = kindFindings(context(edition, files, declaration));
    assert.deepEqual(findings.map((finding) => finding.code), ['BE_KIND_EMPTY']);
    assert.equal(findings[0].path, 'be/src/features/jobs/send/');
  });

  test(`${edition} BE_KIND_EMPTY accepts populated kind members`, () => {
    assert.deepEqual(kindFindings(context(edition, [...api, ...job, ...platform], declaration)), []);
  });
}
