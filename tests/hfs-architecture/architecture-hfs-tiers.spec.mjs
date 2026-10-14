import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';
import { stronglyConnected } from '../../scripts/hfs/architecture/tiers.mjs';
import { byCodeUnit } from '../../scripts/lib/list.mjs';

// HFS checks 1 and 2: the tier direction matrix of knowledge/hfs/slots.yaml and owner cycles.

const beDirection = report => findings(report, 'BE_TIER_DIRECTION');
const featureImports = report => findings(report, 'BE_FEATURE_IMPORTS_FEATURE');

test('BE: a feature importing another feature is BE_FEATURE_IMPORTS_FEATURE, never BE_TIER_DIRECTION (R28)', t => {
  const root = archFixture(t, {
    files: {
      'src/features/api/a/index.ts': "import { b } from '../b';\nexport const a = b + 1;\n",
      'src/features/api/b/index.ts': 'export const b = 1;\n',
    },
  });
  const report = runArch(root);
  assert.deepEqual(beDirection(report), []);
  const hits = featureImports(report);
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].path, 'src/features/api/a/index.ts');
  assert.equal(hits[0].resolvedPath, 'src/features/api/b/index.ts');
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
      'src/features/api/a/index.ts': "import { x } from '../../../modules/domain/x';\nimport { p } from '../../../modules/platform/config';\nimport { i } from '../../../modules/integrations/mail';\nimport { inner } from './application/inner';\nexport const a = [x, p, i, inner];\n",
      'src/features/api/a/application/inner.ts': 'export const inner = 1;\n',
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
      'src/features/api/a/index.ts': 'export const a = 1;\n',
      'src/modules/domain/x/index.ts': "import { a } from '../../../features/api/a';\nexport const x = a;\n",
      'src/modules/platform/config/index.ts': "import { x } from '../../domain/x';\nexport const p = x;\n",
      'src/modules/integrations/mail/index.ts': "import { p } from '../../platform/config';\nimport { x } from '../../domain/x';\nexport const i = [p, x];\n",
    },
  });
  const paths = beDirection(runArch(root)).map(item => `${item.path} -> ${item.resolvedPath}`).sort(byCodeUnit);
  assert.deepEqual(paths, [
    'src/modules/domain/x/index.ts -> src/features/api/a/index.ts',
    'src/modules/integrations/mail/index.ts -> src/modules/domain/x/index.ts',
    'src/modules/platform/config/index.ts -> src/modules/domain/x/index.ts',
  ]);
});

test('BE: a type-only import counts and says so', t => {
  const root = archFixture(t, {
    files: {
      'src/features/api/a/index.ts': "import type { B } from '../b';\nexport type A = B;\n",
      'src/features/api/b/index.ts': 'export type B = string;\n',
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

test('FE: page to page is forbidden, route to feature and feature to modules are fine', t => {
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
  assert.match(hits[0].message, /feature owners only from kinds pages to kinds overlays; it imports pages -> pages/);
});

test('FE: pages compose overlay and block owners through their public entries; every feature still imports blocks', t => {
  const files = {
    'apps/web/src/features/pages/Home/index.tsx': "import { Confirm } from '../../overlays/Confirm';\nimport type { ConfirmProps } from '../../overlays/Confirm';\nexport { Confirm } from '../../overlays/Confirm';\nimport { Order } from '../../../components/blocks/Order';\nimport { view } from './component';\nexport const Home = [Confirm, Order, view];\nexport type HomeProps = ConfirmProps;\n",
    'apps/web/src/features/pages/Home/component.tsx': 'export const view = 1;\n',
    'apps/web/src/features/overlays/Confirm/index.tsx': 'export const Confirm = 1;\nexport type ConfirmProps = string;\n',
    'apps/web/src/components/blocks/Order/index.tsx': 'export const Order = 1;\n',
  };
  for (const kind of ['pages', 'layouts', 'overlays']) {
    files[`apps/web/src/features/${kind}/Compose/index.tsx`] = "import { Order } from '../../../components/blocks/Order';\nimport { view } from './component';\nexport const Compose = [Order, view];\n";
    files[`apps/web/src/features/${kind}/Compose/component.tsx`] = 'export const view = 1;\n';
  }
  const report = runArch(archFixture(t, { profile: 'fe', files }));
  assert.deepEqual(findings(report, 'FE_TIER_DIRECTION'), []);
  assert.deepEqual(findings(report, 'ARCH_OWNER_EXPORT_BYPASS'), []);
});

test('FE: layouts, overlays and providers still cannot import overlay owners', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: {
      'apps/web/src/features/overlays/Confirm/index.tsx': 'export const Confirm = 1;\n',
      'apps/web/src/features/layouts/Shell/index.tsx': "import { Confirm } from '../../overlays/Confirm';\nexport const Shell = Confirm;\n",
      'apps/web/src/features/overlays/Other/index.tsx': "import { Confirm } from '../Confirm';\nexport const Other = Confirm;\n",
      'apps/web/src/components/providers/Theme/index.tsx': "import { Confirm } from '../../../features/overlays/Confirm';\nexport const Theme = Confirm;\n",
    },
  });
  const hits = findings(runArch(root), 'FE_TIER_DIRECTION');
  assert.deepEqual(hits.map(item => item.path), [
    'apps/web/src/components/providers/Theme/index.tsx',
    'apps/web/src/features/layouts/Shell/index.tsx',
    'apps/web/src/features/overlays/Other/index.tsx',
  ]);
  for (const item of hits) assert.match(item.message, /only from kinds pages to kinds overlays/);
});

test('FE: overlays never import pages or layouts; type-only imports and re-exports keep the target-kind restriction', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: {
      'apps/web/src/features/pages/Home/index.tsx': 'export type Home = string;\n',
      'apps/web/src/features/layouts/Shell/index.tsx': 'export const Shell = 1;\n',
      'apps/web/src/features/overlays/Confirm/index.tsx': "import type { Home } from '../../pages/Home';\nexport { Shell } from '../../layouts/Shell';\nexport type Confirm = Home;\n",
    },
  });
  const hits = findings(runArch(root), 'FE_TIER_DIRECTION');
  assert.deepEqual(hits.map(item => [item.resolvedPath, item.typeOnly]), [
    ['apps/web/src/features/pages/Home/index.tsx', true],
    ['apps/web/src/features/layouts/Shell/index.tsx', false],
  ]);
});

test('FE: newly permitted overlay and block imports preserve public-entry and cross-app restrictions', t => {
  const root = archFixture(t, {
    profile: 'fe',
    apps: [{ name: 'web', kind: 'next' }, { name: 'admin', kind: 'next' }],
    files: {
      'apps/web/src/features/pages/Home/index.tsx': "import { view } from '../../overlays/Confirm/component';\nimport { Confirm } from '../../../../../admin/src/features/overlays/Confirm';\nimport { Order } from '../../../../../admin/src/components/blocks/Order';\nexport const Home = [view, Confirm, Order];\n",
      'apps/web/src/features/overlays/Confirm/index.tsx': 'export const Confirm = 1;\n',
      'apps/web/src/features/overlays/Confirm/component.tsx': 'export const view = 1;\n',
      'apps/admin/src/features/overlays/Confirm/index.tsx': 'export const Confirm = 1;\n',
      'apps/admin/src/components/blocks/Order/index.tsx': 'export const Order = 1;\n',
    },
  });
  const report = runArch(root);
  assert.deepEqual(findings(report, 'FE_TIER_DIRECTION'), []);
  assert.deepEqual(findings(report, 'ARCH_OWNER_EXPORT_BYPASS').map(item => item.resolvedPath), ['apps/web/src/features/overlays/Confirm/component.tsx']);
  assert.deepEqual(findings(report, 'FE_APP_ISOLATION').map(item => item.resolvedPath), [
    'apps/admin/src/features/overlays/Confirm/index.tsx',
    'apps/admin/src/components/blocks/Order/index.tsx',
  ]);
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

test('FE: blocks and lower component layers still cannot import another block or their own layer', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: {
      'apps/web/src/components/blocks/Order/index.tsx': "import { Card } from '../Card';\nexport const Order = Card;\n",
      'apps/web/src/components/blocks/Card/index.tsx': 'export const Card = 1;\n',
      'apps/web/src/components/composites/List/index.tsx': "import { Card } from '../../blocks/Card';\nexport const List = Card;\n",
      'apps/web/src/components/branches/Row/index.tsx': "import { Card } from '../../blocks/Card';\nimport { Other } from '../Other';\nexport const Row = [Card, Other];\n",
      'apps/web/src/components/branches/Other/index.tsx': 'export const Other = 1;\n',
    },
  });
  const hits = findings(runArch(root), 'FE_TIER_DIRECTION');
  assert.deepEqual(hits.map(item => `${item.path} -> ${item.resolvedPath}`), [
    'apps/web/src/components/blocks/Order/index.tsx -> apps/web/src/components/blocks/Card/index.tsx',
    'apps/web/src/components/branches/Row/index.tsx -> apps/web/src/components/blocks/Card/index.tsx',
    'apps/web/src/components/branches/Row/index.tsx -> apps/web/src/components/branches/Other/index.tsx',
    'apps/web/src/components/composites/List/index.tsx -> apps/web/src/components/blocks/Card/index.tsx',
  ]);
  for (const item of hits) assert.match(item.message, /may import only the layers after it/);
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

test('FE: a "use server" module has no tier or owner-entry exemption: a block reaching into it is judged like any deep import', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: {
      'apps/web/src/components/blocks/Order/index.tsx': "import { writeOrder } from '../../../modules/orders/write-order';\nexport const Order = [writeOrder];\n",
      'apps/web/src/modules/orders/index.ts': 'export const orders = 1;\n',
      'apps/web/src/modules/orders/write-order.ts': "'use server';\nexport const writeOrder = async () => 1;\n",
    },
  });
  const report = runArch(root);
  const edge = item => `${item.path} -> ${item.resolvedPath}`;
  assert.deepEqual(findings(report, 'FE_TIER_DIRECTION').map(edge), ['apps/web/src/components/blocks/Order/index.tsx -> apps/web/src/modules/orders/write-order.ts']);
  assert.deepEqual(findings(report, 'ARCH_OWNER_EXPORT_BYPASS').map(edge), ['apps/web/src/components/blocks/Order/index.tsx -> apps/web/src/modules/orders/write-order.ts']);
  assert.deepEqual(findings(report, 'FE_SERVER_ACTION_FORBIDDEN').map(item => item.path), ['apps/web/src/modules/orders/write-order.ts']);
});

test('stronglyConnected finds only multi-node components', () => {
  const graph = new Map([['a', new Set(['b'])], ['b', new Set(['c'])], ['c', new Set(['a', 'd'])], ['d', new Set()], ['e', new Set(['e'])]]);
  const components = stronglyConnected(graph).map(component => [...component].sort(byCodeUnit));
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
    'src/features/api/a/index.ts': "import { XEntity } from '../../../modules/domain/x/persistence/entities/x.entity';\nexport const a = XEntity;\n",
    'src/tests/fixtures/other.contracts.ts': entity.replace('../../../', '../../') };
  assert.deepEqual(deep(runArch(archFixture(t, { files: bad }))).sort(byCodeUnit), ['src/features/api/a/index.ts', 'src/tests/fixtures/other.contracts.ts']);
});
