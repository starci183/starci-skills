// proves: FE_SERVICE_ROLE_FORBIDDEN@lite
// proves: FE_SERVICE_ROLE_FORBIDDEN@full
import test from 'node:test';
import assert from 'node:assert/strict';
import { appDeclaration, archFixture, runArch } from './helpers/hfs-arch-fixture.mjs';

const code = 'FE_SERVICE_ROLE_FORBIDDEN';

function fixture(t, edition, invalid) {
  const declaration = appDeclaration('fe', { apps: [{ name: 'web', kind: 'next' }] });
  declaration.edition = edition;
  declaration.sides.be.connections = [{ name: 'primary', envPrefix: 'PRIMARY_DB', owner: 'core', isolation: 'schema', provider: 'supabase' }];
  return archFixture(t, { profile: 'fe', files: {
    '../hfs.json': JSON.stringify(declaration),
    'apps/web/src/modules/config/index.ts': invalid
      ? 'export const role = "service_role"; export const credential = process.env.NEXT_PUBLIC_SESSION_TOKEN;'
      : 'export const url = process.env.NEXT_PUBLIC_SUPABASE_URL; export const analytics = process.env.NEXT_PUBLIC_ANALYTICS_ID;',
  } });
}

for (const edition of ['lite', 'full']) {
  test(`${code} ${edition}: refuses service-role names and credential-shaped reads`, t => {
    const report = runArch(fixture(t, edition, true));
    const violations = report.violations.filter(item => item.ruleId === code);
    assert.ok(report.coverage.checkedRuleIds.includes(code));
    assert.ok(violations.some(item => item.name === 'service_role'));
    assert.ok(violations.some(item => item.name === 'NEXT_PUBLIC_SESSION_TOKEN'));
  });

  test(`${code} ${edition}: accepts public configuration at the config owner`, t => {
    const report = runArch(fixture(t, edition, false));
    assert.ok(report.coverage.checkedRuleIds.includes(code));
    assert.deepEqual(report.violations.filter(item => item.ruleId === code), []);
  });
}
