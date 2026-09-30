import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-fixture.mjs';

// R56 hooks-are-hooks (FE_HOOKS_ARE_HOOKS): the repository half of the eslint hooks-folder rule. A hooks domain holds one
// shared file named <domain>.shared.ts, and a non-hook helper name is declared in one file of the domain only.
const HOOKS = 'apps/web/src/hooks/course';
const GOOD = {
  [`${HOOKS}/index.ts`]: "export { useCourse } from './useCourse';\n",
  [`${HOOKS}/useCourse.ts`]: "import { courseKey } from './course.shared';\nexport const useCourse = (id: string) => courseKey(id);\n",
  [`${HOOKS}/useLesson.ts`]: "import { courseKey } from './course.shared';\nexport const useLesson = (id: string) => courseKey(id);\n",
  [`${HOOKS}/course.shared.ts`]: 'export const courseKey = (id: string) => `course:${id}`;\n',
};
const hits = report => findings(report, 'FE_HOOKS_ARE_HOOKS');
const run = (t, files) => runArch(archFixture(t, { profile: 'fe', files: { ...GOOD, ...files } }));

test('hooks that share one course.shared.ts and declare no helper twice raise no FE_HOOKS_ARE_HOOKS', t => {
  const report = run(t, {});
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.hooksAreHooks.status, 'checked');
  assert.equal(report.coverage.hfsMachine.hooksAreHooks.domains, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('FE_HOOKS_ARE_HOOKS'));
});

test('a shared file named for another domain, and a second shared file, are FE_HOOKS_ARE_HOOKS', t => {
  const report = run(t, {
    [`${HOOKS}/cart.shared.ts`]: 'export const cartKey = (id: string) => id;\n',
    'apps/web/src/hooks/cart/index.ts': "export { useCart } from './useCart';\n",
    'apps/web/src/hooks/cart/useCart.ts': 'export const useCart = () => 1;\n',
    'apps/web/src/hooks/cart/cart.shared.ts': 'export const cartId = 1;\n',
    'apps/web/src/hooks/cart/more.shared.ts': 'export const moreId = 1;\n',
  });
  assert.deepEqual(hits(report).map(item => item.path).sort(), ['apps/web/src/hooks/cart/more.shared.ts', `${HOOKS}/cart.shared.ts`]);
});

test('a helper declared in two files of one domain is FE_HOOKS_ARE_HOOKS at the later file, hooks and other domains excepted', t => {
  const report = run(t, {
    [`${HOOKS}/useA.ts`]: "const buildKey = (id: string) => id;\nexport const useA = () => buildKey('a');\n",
    [`${HOOKS}/useB.ts`]: "function buildKey(id: string) { return id; }\nexport const useB = () => buildKey('b');\n",
    'apps/web/src/hooks/cart/index.ts': "export { useCart } from './useCart';\n",
    'apps/web/src/hooks/cart/useCart.ts': "const buildKey = (id: string) => id;\nexport const useCart = () => buildKey('c');\n",
  });
  const found = hits(report);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].helper, 'buildKey');
  assert.equal(found[0].path, `${HOOKS}/useB.ts`);
  assert.match(found[0].message, /also in apps\/web\/src\/hooks\/course\/useA\.ts/);
});
