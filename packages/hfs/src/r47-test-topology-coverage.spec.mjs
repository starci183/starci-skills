// proves: BE_TEST_TOPOLOGY@lite BE_TEST_TOPOLOGY@full
// proves: BE_UNIT_SPEC_NOT_STAGED@lite BE_UNIT_SPEC_NOT_STAGED@full
// proves: BE_CONTRACT_UNGUARDED@lite BE_CONTRACT_UNGUARDED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, ts } from './helpers/hfs-arch-fixture.mjs';
import { checkHfs } from '../runtime/scripts/hfs/architecture/hfs.mjs';
import { testTopologyFindings } from '../runtime/scripts/hfs/rules/test-topology.mjs';
import { checkContractFixtureGuard } from '../runtime/scripts/hfs/architecture/contract-fixture-guard.mjs';
import { loadArchitectureConfig } from '../runtime/scripts/hfs/architecture/config.mjs';
import { buildTypeScriptContext } from '../runtime/scripts/hfs/architecture/typescript.mjs';
import { buildHfsGraph } from '../runtime/scripts/hfs/architecture/hfs-graph.mjs';
import { byCodeUnit } from '../runtime/scripts/lib/list.mjs';
import { stagedSpecFindings } from '../runtime/scripts/hfs/rules/staged-specs.mjs';
import { loadSlotManifest } from '../runtime/scripts/hfs/slots.mjs';

function fixture(t, edition, profile, files) {
  return archFixture(t, { profile, files: {
    ...files,
    '../hfs.json': JSON.stringify({ ...appDeclaration(profile, { apps: [{ name: profile === 'be' ? 'core' : 'web', kind: profile === 'be' ? 'api' : 'next' }] }), edition }),
  } });
}

function contractFindings(root) {
  const config = loadArchitectureConfig(root);
  const context = buildTypeScriptContext(config, ts, []);
  const graph = buildHfsGraph(config, context);
  return checkContractFixtureGuard({ config, context, graph }).violations;
}

const payload = 'src/tests/world/fakes/sepay/payloads/payment.json';
const contract = 'src/tests/contract/sepay/payment.contract-spec.ts';
const guard = `import { shapeOf } from '../../world/payload-shape.policy';
import { renderPayload } from '../../world/fakes/payload.service';
declare const real: unknown;
it('matches the provider fixture', () => {
  expect(shapeOf(real)).toEqual(shapeOf(renderPayload('sepay', 'payment')));
});
`;

for (const edition of ['lite', 'full']) {
  test(`${edition} backend rejects unsupported test suffixes`, t => {
    const root = fixture(t, edition, 'be', {
      'src/modules/domain/cart/schema.int-spec.ts': 'export {};',
      'src/tests/e2e/cart/flow.harness-spec.ts': 'export {};',
    });
    const hits = checkHfs({ root, kinds: ['backend'] }).violations.filter(hit => hit.ruleId === 'BE_TEST_TOPOLOGY');
    assert.deepEqual(hits.map(hit => hit.ruleId), ['BE_TEST_TOPOLOGY', 'BE_TEST_TOPOLOGY']);
    assert.deepEqual(hits.map(hit => hit.path).sort(byCodeUnit), ['src/modules/domain/cart/schema.int-spec.ts', 'src/tests/e2e/cart/flow.harness-spec.ts']);
  });

  test(`${edition} backend accepts sanctioned test names`, t => {
    const root = fixture(t, edition, 'be', {
      'src/modules/domain/cart/cart.service.spec.ts': 'export {};',
      'src/tests/integration/cart/cart.integration-spec.ts': 'export {};',
      'src/tests/e2e/cart/cart.e2e-spec.ts': 'export {};',
      'src/tests/contract/sepay/payment.contract-spec.ts': 'export {};',
    });
    assert.deepEqual(checkHfs({ root, kinds: ['backend'] }).violations.filter(hit => hit.ruleId === 'BE_TEST_TOPOLOGY'), []);
  });

  test(`${edition} frontend passes unsupported backend suffixes without topology judgment`, t => {
    const root = fixture(t, edition, 'fe', {
      'apps/web/src/app/schema.int-spec.ts': 'export {};',
      'apps/web/src/app/flow.harness-spec.ts': 'export {};',
    });
    assert.deepEqual(checkHfs({ root, kinds: ['frontend'] }).violations.filter(hit => hit.ruleId === 'BE_TEST_TOPOLOGY'), []);
  });

  test(`${edition} topology tree rejects test aliases and extra jest configuration`, t => {
    const files = ['src/modules/domain/cart/cart.test.ts', 'src/modules/domain/cart/testing/mock.ts', 'jest.config.e2e.js', 'package.json'];
    const root = fixture(t, edition, 'be', { 'package.json': JSON.stringify({ jest: {} }) });
    assert.deepEqual(testTopologyFindings({ repoRoot: root, files }).map(hit => hit.code), Array(4).fill('BE_TEST_TOPOLOGY'));
  });

  test(`${edition} topology tree accepts colocated specs and one root jest configuration`, t => {
    const root = fixture(t, edition, 'be', {});
    assert.deepEqual(testTopologyFindings({ repoRoot: root, files: ['src/modules/domain/cart/cart.service.spec.ts', 'jest.config.js'] }), []);
  });

  test(`${edition} contract guard rejects an unguarded provider payload`, t => {
    const root = fixture(t, edition, 'be', { [payload]: '{}' });
    assert.deepEqual(contractFindings(root).map(hit => hit.ruleId), ['BE_CONTRACT_UNGUARDED']);
    assert.deepEqual(contractFindings(root).map(hit => hit.path), [payload]);
  });

  test(`${edition} contract guard accepts a fixture compared with the real provider shape`, t => {
    const root = fixture(t, edition, 'be', { [payload]: '{}', [contract]: guard });
    assert.deepEqual(contractFindings(root), []);
  });
}

const policy = 'be/src/modules/domain/order/order.policy.ts';
const policyText = 'export const allowed = (amount) => amount > 0;';

for (const edition of ['lite', 'full']) {
  test(`${edition} staged specs reject a new measured logic file staged without its sibling spec`, () => {
    const found = stagedSpecFindings(loadSlotManifest(), [policy], new Set([policy]), { ts, staged: () => policyText });
    assert.deepEqual(found.map(hit => hit.code), ['BE_UNIT_SPEC_NOT_STAGED']);
    assert.deepEqual(found.map(hit => hit.file), [policy]);
  });

  test(`${edition} staged specs pass a logic file staged with its spec and a constants-only file`, () => {
    const manifest = loadSlotManifest();
    const spec = 'be/src/modules/domain/order/order.policy.spec.ts';
    assert.deepEqual(stagedSpecFindings(manifest, [policy, spec], new Set([policy, spec]), { ts, staged: () => policyText }), []);
    assert.deepEqual(stagedSpecFindings(manifest, [policy], new Set([policy]), { ts, staged: () => 'export const STATUS = 1;' }), []);
  });
}
