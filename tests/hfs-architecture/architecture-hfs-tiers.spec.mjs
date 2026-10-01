import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';
import { stronglyConnected } from '../../scripts/hfs/architecture/tiers.mjs';

// HFS checks 1 and 2: the tier direction matrix of knowledge/hfs/slots.yaml and owner cycles.

const beDirection = report => findings(report, 'BE_TIER_DIRECTION');
const featureImports = report => findings(report, 'BE_FEATURE_IMPORTS_FEATURE');

test('BE: a feature importing another feature is BE_FEATURE_IMPORTS_FEATURE, never BE_TIER_DIRECTION (R28)', t => {
  const root = archFixture(t, {
    files: {
      'src/features/a/index.ts': "import { b } from '../b';\nexport const a = b + 1;\n",
      'src/features/b/index.ts': 'export const b = 1;\n',
    },
  });
  const report = runArch(root);
  assert.deepEqual(beDirection(report), []);
  const hits = featureImports(report);
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].path, 'src/features/a/index.ts');
  assert.equal(hits[0].resolvedPath, 'src/features/b/index.ts');
  assert.equal(hits[0].fromTier, 'feature');
  assert.equal(hits[0].toTier, 'feature');
  assert.equal(hits[0].typeOnly, false);
  assert.equal(report.coverage.hfsMachine.tiers.status, 'checked');
  assert.ok(report.coverage.checkedRuleIds.includes('BE_TIER_DIRECTION'));
  assert.ok(report.coverage.checkedRuleIds.includes('BE_FEATURE_IMPORTS_FEATURE'));
});

test('BE: a feature may import domain, platform and integrations; an import inside one owner is always fine', t => {
  const root = archFixture(t, {
    files: {
      'src/features/a/index.ts': "import { x } from '../../modules/domain/x';\nimport { p } from '../../modules/platform/config';\nimport { i } from '../../modules/integrations/mail';\nimport { inner } from './application/inner';\nexport const a = [x, p, i, inner];\n",
      'src/features/a/application/inner.ts': 'export const inner = 1;\n',
      'src/modules/domain/x/index.ts': 'export const x = 1;\n',
      'src/modules/platform/config/index.ts': 'export const p = 1;\n',
      'src/modules/integrations/mail/index.ts': 'export const i = 1;\n',
    },
  });
  const report = runArch(root);
  assert.deepEqual(beDirection(report), []);
  assert.deepEqual(findings(report, 'BE_FEATURE_IMPORTS_FEATURE'), []);
});

test('BE: domain, platform and integrations never import a feature or an app; platform never imports domain', t => {
  const root = archFixture(t, {
    files: {
      'src/features/a/index.ts': 'export const a = 1;\n',
      'src/modules/domain/x/index.ts': "import { a } from '../../../features/a';\nexport const x = a;\n",
      'src/modules/platform/config/index.ts': "import { x } from '../../domain/x';\nexport const p = x;\n",
      'src/modules/integrations/mail/index.ts': "import { p } from '../../platform/config';\nimport { x } from '../../domain/x';\nexport const i = [p, x];\n",
    },
  });
  const paths = beDirection(runArch(root)).map(item => `${item.path} -> ${item.resolvedPath}`).sort();
  assert.deepEqual(paths, [
    'src/modules/domain/x/index.ts -> src/features/a/index.ts',
    'src/modules/integrations/mail/index.ts -> src/modules/domain/x/index.ts',
    'src/modules/platform/config/index.ts -> src/modules/domain/x/index.ts',
  ]);
});

test('BE: a type-only import counts and says so', t => {
  const root = archFixture(t, {
    files: {
      'src/features/a/index.ts': "import type { B } from '../b';\nexport type A = B;\n",
      'src/features/b/index.ts': 'export type B = string;\n',
    },
  });
  const hits = featureImports(runArch(root));
  assert.equal(hits.length, 1);
  assert.equal(hits[0].typeOnly, true);
  assert.match(hits[0].message, /type-only imports count/);
});

test('BE: two domain owners that import each other form a cycle reported with its path, type-only edges included', t => {
  const root = archFixture(t, {
    files: {
      'src/modules/domain/x/index.ts': "import { y } from '../y';\nexport const x = y;\n",
      'src/modules/domain/y/index.ts': "import type { X } from '../x';\nexport const y = 1;\nexport type Y = X;\n",
    },
  });
  const report = runArch(root);
  const cycles = findings(report, 'ARCH_OWNER_CYCLE');
  assert.equal(cycles.length, 1, JSON.stringify(cycles));
  assert.deepEqual(cycles[0].cycle, ['src/modules/domain/x', 'src/modules/domain/y', 'src/modules/domain/x']);
  assert.equal(cycles[0].componentSize, 2);
  assert.equal(cycles[0].cycleImports.length, 2);
  assert.equal(cycles[0].cycleImports[1].typeOnly, true);
  assert.match(cycles[0].message, /src\/modules\/domain\/x -> src\/modules\/domain\/y -> src\/modules\/domain\/x/);
  assert.equal(report.coverage.hfsMachine.tiers.cycles, 1);
  assert.deepEqual(beDirection(report), []);
});

test('BE: a three-owner cycle is one finding and an acyclic chain is none', t => {
  const cyclic = archFixture(t, {
    files: {
      'src/modules/domain/a/index.ts': "import { b } from '../b';\nexport const a = b;\n",
      'src/modules/domain/b/index.ts': "import { c } from '../c';\nexport const b = c;\n",
      'src/modules/domain/c/index.ts': "import { a } from '../a';\nexport const c = a;\n",
    },
  });
  const cycles = findings(runArch(cyclic), 'ARCH_OWNER_CYCLE');
  assert.equal(cycles.length, 1);
  assert.equal(cycles[0].cycle.length, 4);
  assert.equal(cycles[0].componentSize, 3);

  const chain = archFixture(t, {
    files: {
      'src/modules/domain/a/index.ts': "import { b } from '../b';\nexport const a = b;\n",
      'src/modules/domain/b/index.ts': "import { c } from '../c';\nexport const b = c;\n",
      'src/modules/domain/c/index.ts': 'export const c = 1;\n',
    },
  });
  assert.deepEqual(findings(runArch(chain), 'ARCH_OWNER_CYCLE'), []);
});

test('FE: feature to feature is forbidden, route to feature and feature to modules are fine', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: {
      'apps/web/src/features/pages/A/index.tsx': "import { b } from '../B';\nimport { m } from '../../../modules/i18n';\nexport const A = [b, m];\n",
      'apps/web/src/features/pages/B/index.tsx': 'export const b = 1;\n',
      'apps/web/src/modules/i18n/index.ts': 'export const m = 1;\n',
      'apps/web/src/app/[locale]/page.tsx': "import { A } from '../../features/pages/A';\nexport default A;\n",
    },
  });
  const report = runArch(root);
  const hits = findings(report, 'FE_TIER_DIRECTION');
  assert.deepEqual(findings(report, 'FE_APP_ISOLATION'), [], 'one app importing its own modules is not an isolation finding');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].path, 'apps/web/src/features/pages/A/index.tsx');
  assert.equal(hits[0].resolvedPath, 'apps/web/src/features/pages/B/index.tsx');
});

test('FE: an app never imports another app', t => {
  const root = archFixture(t, {
    profile: 'fe',
    apps: [{ name: 'web', kind: 'next' }, { name: 'admin', kind: 'next' }],
    files: {
      'apps/web/src/features/pages/A/index.tsx': "import { z } from '../../../../../admin/src/features/pages/Z';\nexport const A = z;\n",
      'apps/admin/src/features/pages/Z/index.tsx': 'export const z = 1;\n',
    },
  });
  const hits = findings(runArch(root), 'FE_APP_ISOLATION');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.match(hits[0].message, /app web imports app admin/);
});

test('FE: a component layer imports only the layers after it', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: {
      'apps/web/src/components/blocks/Card/index.tsx': "import { Btn } from '../../leaves/Btn';\nexport const Card = Btn;\n",
      'apps/web/src/components/leaves/Btn/index.tsx': "import { Card } from '../../blocks/Card';\nexport const Btn = Card;\n",
    },
  });
  const hits = findings(runArch(root), 'FE_TIER_DIRECTION');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].path, 'apps/web/src/components/leaves/Btn/index.tsx');
  assert.match(hits[0].message, /leaves component may import only the layers after it; it imports a blocks/);
});

test('FE: a component may import config but not the api transport; a hook reaches the transport and another domain only through its index', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: {
      'apps/web/src/components/leaves/Btn/index.tsx': "import { c } from '../../../modules/config';\nimport { call } from '../../../modules/api';\nexport const Btn = [c, call];\n",
      'apps/web/src/modules/config/index.ts': 'export const c = 1;\n',
      'apps/web/src/modules/api/index.ts': 'export const call = 1;\n',
      'apps/web/src/hooks/orders/index.ts': "import { call } from '../../modules/api';\nimport { useCart } from '../cart';\nimport { deep } from '../cart/useDeep';\nexport const useOrders = [call, useCart, deep];\n",
      'apps/web/src/hooks/cart/index.ts': 'export const useCart = 1;\n',
      'apps/web/src/hooks/cart/useDeep.ts': 'export const deep = 1;\n',
    },
  });
  const report = runArch(root);
  const hits = findings(report, 'FE_TIER_DIRECTION').map(item => `${item.path} -> ${item.resolvedPath}`);
  assert.deepEqual(hits, ['apps/web/src/components/leaves/Btn/index.tsx -> apps/web/src/modules/api/index.ts']);
  const bypass = findings(report, 'ARCH_OWNER_EXPORT_BYPASS').map(item => `${item.path} -> ${item.resolvedPath}`);
  assert.deepEqual(bypass, ['apps/web/src/hooks/orders/index.ts -> apps/web/src/hooks/cart/useDeep.ts']);
});

test('stronglyConnected finds only multi-node components', () => {
  const graph = new Map([['a', new Set(['b'])], ['b', new Set(['c'])], ['c', new Set(['a', 'd'])], ['d', new Set()], ['e', new Set(['e'])]]);
  const components = stronglyConnected(graph).map(component => [...component].sort());
  assert.deepEqual(components, [['a', 'b', 'c']]);
});

// A *.builder.ts (slot be.tests.fixtures.builders) arranges data at the schema level and may deep-import persistence entities;
// no other program file may. (Specs are outside the production program: their deep imports are the eslint rules' business.)
test('ARCH_OWNER_EXPORT_BYPASS: a builder may deep-import a capability entity, a production file or another fixture may not', t => {
  const entity = "import { XEntity } from '../../../modules/domain/x/persistence/entities/x.entity';\nexport const rows = [XEntity];\n";
  const deep = report => findings(report, 'ARCH_OWNER_EXPORT_BYPASS').map(item => item.path);
  const files = {
    'src/modules/domain/x/index.ts': 'export const x = 1;\n',
    'src/modules/domain/x/persistence/entities/x.entity.ts': 'export class XEntity {}\n',
    'src/tests/fixtures/builders/x.builder.ts': entity,
  };
  assert.deepEqual(deep(runArch(archFixture(t, { files }))), []);
  const bad = { ...files,
    'src/features/a/index.ts': "import { XEntity } from '../../modules/domain/x/persistence/entities/x.entity';\nexport const a = XEntity;\n",
    'src/tests/fixtures/other.contracts.ts': entity.replace('../../../', '../../') };
  assert.deepEqual(deep(runArch(archFixture(t, { files: bad }))).sort(), ['src/features/a/index.ts', 'src/tests/fixtures/other.contracts.ts']);
});
