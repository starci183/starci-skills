// proves: BE_SERVICE_ISOLATION@lite BE_SERVICE_ISOLATION@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

const beApps = [{ name: 'orders', kind: 'api' }, { name: 'billing', kind: 'api' }];
const feApps = [{ name: 'web', kind: 'next' }, { name: 'admin', kind: 'next' }];

function fixture(t, edition, files, profile = 'be') {
  const apps = profile === 'be' ? beApps : feApps;
  const declaration = { ...appDeclaration(profile, { apps }), edition };
  return archFixture(t, { profile, apps, files: { ...files, '../hfs.json': `${JSON.stringify(declaration)}\n` } });
}

for (const edition of ['lite', 'full']) {
  test(`BE ${edition}: a literal dynamic import of another app reports BE_SERVICE_ISOLATION (R168)`, t => {
    const root = fixture(t, edition, {
      'apps/orders/src/app.module.ts': 'export const loadBilling = () => import("../../billing/src/app.module");\n',
      'apps/billing/src/app.module.ts': 'export const BillingModule = 1;\n',
    });
    const report = runArch(root);
    const hits = findings(report, 'BE_SERVICE_ISOLATION');
    assert.equal(hits.length, 1, JSON.stringify(hits));
    assert.equal(hits[0].path, 'apps/orders/src/app.module.ts');
    assert.equal(hits[0].resolvedPath, 'apps/billing/src/app.module.ts');
    assert.equal(hits[0].specifier, '../../billing/src/app.module');
    assert.equal(hits[0].typeOnly, false);
    assert.match(hits[0].message, /app orders imports app billing/);
    assert.deepEqual(findings(report, 'FE_APP_ISOLATION'), []);
    assert.equal(report.coverage.hfsMachine.tiers.crossApp, 1);
    assert.ok(report.coverage.checkedRuleIds.includes('BE_SERVICE_ISOLATION'));
  });

  test(`BE ${edition}: static imports, re-exports and type-only cross-app imports retain service isolation`, t => {
    const root = fixture(t, edition, {
      'apps/orders/src/app.module.ts': 'import { BillingModule } from "../../billing/src/app.module";\nimport type { Billing } from "../../billing/src/app.module";\nexport { BillingModule } from "../../billing/src/app.module";\nexport const AppModule = BillingModule;\nexport type OrderBilling = Billing;\n',
      'apps/billing/src/app.module.ts': 'export const BillingModule = 1;\nexport type Billing = string;\n',
    });
    const report = runArch(root);
    const hits = findings(report, 'BE_SERVICE_ISOLATION');
    assert.equal(hits.length, 3, JSON.stringify(hits));
    assert.deepEqual(hits.map(hit => hit.typeOnly), [false, true, false]);
    assert.match(hits[1].message, /type-only imports count/);
    assert.deepEqual(findings(report, 'FE_APP_ISOLATION'), []);
  });

  test(`BE ${edition}: same-app dynamic imports and shared domain modules pass service isolation`, t => {
    const root = fixture(t, edition, {
      'apps/orders/src/app.module.ts': 'import { shared } from "../../../src/modules/domain/shared";\nexport const AppModule = shared;\nexport const loadOrders = () => import("./orders.module");\n',
      'apps/orders/src/orders.module.ts': 'export const OrdersModule = 1;\n',
      'apps/billing/src/app.module.ts': 'import { shared } from "../../../src/modules/domain/shared";\nexport const BillingModule = shared;\n',
      'src/modules/domain/shared/index.ts': 'export const shared = 1;\n',
    });
    const report = runArch(root);
    assert.deepEqual(findings(report, 'BE_SERVICE_ISOLATION'), []);
    assert.deepEqual(findings(report, 'FE_APP_ISOLATION'), []);
    assert.deepEqual(findings(report, 'BE_TIER_DIRECTION'), []);
    assert.equal(report.coverage.hfsMachine.tiers.crossApp, 0);
    assert.ok(report.coverage.hfsMachine.tiers.edgesChecked >= 3);
  });

  test(`FE ${edition}: cross-app dynamic imports still report FE_APP_ISOLATION`, t => {
    const root = fixture(t, edition, {
      'apps/web/src/features/pages/Home/index.tsx': 'export const loadAdmin = () => import("../../../../../admin/src/features/pages/Admin");\n',
      'apps/admin/src/features/pages/Admin/index.tsx': 'export const Admin = 1;\n',
    }, 'fe');
    const report = runArch(root);
    const hits = findings(report, 'FE_APP_ISOLATION');
    assert.equal(hits.length, 1, JSON.stringify(hits));
    assert.equal(hits[0].resolvedPath, 'apps/admin/src/features/pages/Admin/index.tsx');
    assert.match(hits[0].message, /app web imports app admin/);
    assert.deepEqual(findings(report, 'BE_SERVICE_ISOLATION'), []);
  });
}
