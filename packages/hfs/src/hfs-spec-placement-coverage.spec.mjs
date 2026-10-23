// proves: BE_SPEC_PLACEMENT@lite
// proves: BE_SPEC_PLACEMENT@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration } from '../runtime/scripts/hfs/slots.mjs';
import { specPlacementFindings } from '../runtime/scripts/hfs/rules/spec-placement.mjs';

const manifest = loadSlotManifest();
const resolverFor = (edition) => createSlotResolver(manifest, resolveRepoDeclaration(manifest, {
  hfs: manifest.major,
  kind: 'app',
  project: 'placement-proof',
  edition,
  sides: {
    be: { kinds: ['api'], apps: [{ name: 'core', kind: 'api' }] },
    fe: { apps: [{ name: 'web', kind: 'next' }] },
  },
}, { side: 'be' }));

for (const edition of ['lite', 'full']) {
  test(`${edition} invalid back-end spec locations are refused`, () => {
    const files = [
      'apps/core/src/core.composition.spec.ts',
      'scripts/x.spec.mjs',
      'tools/seed.test.cjs',
      'src/features/api/orders/application/place-order.spec.ts',
      'src/tests/misc/other.e2e-spec.ts',
    ];
    const findings = specPlacementFindings({ files, resolver: resolverFor(edition) });
    assert.deepEqual(findings.map((finding) => [finding.code, finding.path]), [
      ['BE_SPEC_PLACEMENT', 'apps/core/src/core.composition.spec.ts'],
      ['BE_SPEC_PLACEMENT', 'scripts/x.spec.mjs'],
      ['BE_SPEC_PLACEMENT', 'tools/seed.test.cjs'],
      ['BE_SPEC_PLACEMENT', 'src/features/api/orders/application/place-order.spec.ts'],
      ['BE_SPEC_PLACEMENT', 'src/tests/misc/other.e2e-spec.ts'],
    ]);
  });

  test(`${edition} valid service, integration and contract test layers pass`, () => {
    const files = [
      'src/modules/domain/billing/invoice.service.ts',
      'src/modules/domain/billing/invoice.service.spec.ts',
      'src/tests/integration/orders/claim.integration-spec.ts',
      'src/tests/contract/provider/message.contract-spec.ts',
      'scripts/rotate-logs.mjs',
      'node_modules/library/x.spec.ts',
    ];
    if (edition === 'full') files.push('src/tests/e2e/orders/flow.e2e-spec.ts');
    assert.deepEqual(specPlacementFindings({ files, resolver: resolverFor(edition) }), []);
  });
}
