import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-fixture.mjs';

// R94 fe-slot-allows (FE_SLOT_FILE_ROLE): a front-end slot that owns a directory holds only the files its `allows` names,
// inside a folder of its own.
const CLEAN = {
  'apps/web/src/app/.keep': null,
  'apps/web/src/modules/config/index.ts': 'export const config = 1;\n',
  'apps/web/src/hooks/orders/index.ts': "export { useOrders } from './useOrders';\n",
  'apps/web/src/hooks/orders/useOrders.ts': 'export const useOrders = () => 1;\n',
  'apps/web/src/hooks/orders/orders.shared.ts': 'export const key = 1;\n',
  'apps/web/src/app/[locale]/courses/[slug]/page.tsx': 'export default () => null;\n',
  'apps/web/src/app/[locale]/courses/[slug]/default.tsx': 'export default () => null;\n',
  'apps/web/src/app/health/live/route.ts': 'export const GET = () => new Response();\n',
  'apps/web/src/components/leaves/Chip/index.tsx': 'export const Chip = () => null;\n',
  'apps/web/src/components/leaves/Chip/component.tsx': 'export const ChipView = () => null;\n',
  'apps/web/src/components/leaves/Chip/classNames.ts': 'export const chip = 1;\n',
  'apps/web/src/modules/components/x.ts': 'export const x = 1;\n',
};
const hits = report => findings(report, 'FE_SLOT_FILE_ROLE');
const run = (t, extra = {}) => runArch(archFixture(t, { profile: 'fe', files: { ...CLEAN, ...extra } }));

test('files the slots name raise no FE_SLOT_FILE_ROLE, including a folder named like a tier inside a module', t => {
  const report = run(t);
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.feSlotAllows.status, 'checked');
  assert.ok(report.coverage.checkedRuleIds.includes('FE_SLOT_FILE_ROLE'));
});

test('a [lang] segment under app/ and a page.tsx inside a hooks domain are FE_SLOT_FILE_ROLE', t => {
  const paths = hits(run(t, {
    'apps/web/src/app/[lang]/page.tsx': 'export default () => null;\n',
    'apps/web/src/hooks/orders/page.tsx': 'export default () => null;\n',
  })).map(item => item.path).sort();
  assert.deepEqual(paths, ['apps/web/src/app/[lang]/page.tsx', 'apps/web/src/hooks/orders/page.tsx']);
});

test('a hook file directly in hooks/ and a stray file beside a component are FE_SLOT_FILE_ROLE', t => {
  const paths = hits(run(t, {
    'apps/web/src/hooks/useLoose.ts': 'export const useLoose = () => 1;\n',
    'apps/web/src/components/leaves/Chip/helpers.ts': 'export const h = 1;\n',
  })).map(item => item.path).sort();
  assert.deepEqual(paths, ['apps/web/src/components/leaves/Chip/helpers.ts', 'apps/web/src/hooks/useLoose.ts']);
});

// R97 FE_NO_TESTS (contract-change fe-no-tests): a test path of a front end has exactly one finding, FE_NO_TESTS
// (tests/hfs-fe-no-tests.spec.mjs); the slot check leaves it alone, so a spec or test file is never FE_SLOT_FILE_ROLE too.
test('a .spec.tsx or .test.tsx beside a component and a spec in a hooks domain are never FE_SLOT_FILE_ROLE (they are FE_NO_TESTS findings)', t => {
  const report = run(t, {
    'apps/web/src/components/leaves/Chip/index.spec.tsx': 'export {};\n',
    'apps/web/src/components/leaves/Chip/index.test.tsx': 'export {};\n',
    'apps/web/src/hooks/orders/useOrders.spec.ts': 'export {};\n',
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
});
