import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-fixture.mjs';

// R54 route-files-thin (FE_ROUTE_FILES_THIN): a layout, template, loading or not-found route file mounts one feature and draws
// nothing (no host element, no inline component); a route file, page included, holds no hook.
const APP = 'apps/web/src/app/[locale]';
const FEATURES = {
  'apps/web/src/features/layouts/ShopLayout/index.tsx': 'export const ShopLayout = (props: { content: unknown }) => <main>{String(props.content)}</main>;\n',
  'apps/web/src/features/layouts/AuthLayout/index.tsx': 'export const AuthLayout = () => <section />;\n',
  'apps/web/src/features/pages/CartPage/index.tsx': 'export const CartPage = () => <article />;\n',
  'apps/web/src/hooks/session/useSession.ts': 'export const useSession = () => 1;\n',
};
const LAYOUT = (body, imports = '') => `import { Shell } from '@fixture/shell';\nimport { ShopLayout } from '../../features/layouts/ShopLayout';\nimport { AuthLayout } from '../../features/layouts/AuthLayout';\n${imports}${body}\n`;
const GOOD_LAYOUT = LAYOUT('const Layout = ({ children }: { children: unknown }) => (\n  <Shell>\n    <ShopLayout content={children} />\n  </Shell>\n);\nexport default Layout;');
const hits = report => findings(report, 'FE_ROUTE_FILES_THIN');
const run = (t, files) => runArch(archFixture(t, { profile: 'fe', files: { ...FEATURES, ...files } }));

test('a layout wrapping one feature in a package shell, and delegating loading and not-found files, raise no FE_ROUTE_FILES_THIN', t => {
  const report = run(t, {
    [`${APP}/layout.tsx`]: GOOD_LAYOUT,
    [`${APP}/loading.tsx`]: "import { LocaleLoading } from '@fixture/shell';\nexport default LocaleLoading;\n",
    [`${APP}/not-found.tsx`]: "import { LocaleNotFound } from '@fixture/shell';\nexport default LocaleNotFound;\n",
    [`${APP}/cart/page.tsx`]: "import { CartPage } from '../../../features/pages/CartPage';\nconst Page = () => <CartPage />;\nexport default Page;\n",
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.routeFilesThin.status, 'checked');
  assert.equal(report.coverage.hfsMachine.routeFilesThin.routes, 4);
  assert.ok(report.coverage.checkedRuleIds.includes('FE_ROUTE_FILES_THIN'));
});

test('a host element in a layout or template is drawing, and is FE_ROUTE_FILES_THIN', t => {
  const report = run(t, {
    [`${APP}/layout.tsx`]: LAYOUT('export default function Layout() {\n  return <div className="shell"><ShopLayout content={null} /></div>;\n}'),
    [`${APP}/template.tsx`]: LAYOUT('export default function Template() {\n  return <><main /><ShopLayout content={null} /></>;\n}'),
  });
  assert.deepEqual(hits(report).map(item => `${item.route}:${/^<([a-z]+)> is drawing/.exec(item.message)?.[1]}`).sort(), ['layout:div', 'template:main']);
});

test('an inline component beside the default export is FE_ROUTE_FILES_THIN', t => {
  const report = run(t, {
    [`${APP}/not-found.tsx`]: LAYOUT('const Message = () => <Shell />;\nconst NotFound = () => <ShopLayout content={<Message />} />;\nexport default NotFound;'),
  });
  const found = hits(report);
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.match(found[0].message, /inline component/);
});

test('a route file that mounts two feature owners, or JSX with no feature, is FE_ROUTE_FILES_THIN', t => {
  const report = run(t, {
    [`${APP}/layout.tsx`]: LAYOUT('export default () => (\n  <Shell>\n    <ShopLayout content={null} />\n    <AuthLayout />\n  </Shell>\n);'),
    [`${APP}/loading.tsx`]: LAYOUT('export default () => <Shell />;'),
  });
  assert.deepEqual(hits(report).map(item => `${item.route}:${item.owners}`).sort(), ['layout:2', 'loading:0']);
});

test('a hook called in a route file, page included, is FE_ROUTE_FILES_THIN; a server-side data call is not', t => {
  const report = run(t, {
    [`${APP}/layout.tsx`]: LAYOUT("export default () => {\n  useTranslations('shop');\n  return <ShopLayout content={null} />;\n};", "import { useTranslations } from 'next-intl';\n"),
    [`${APP}/cart/page.tsx`]: "import { useSession } from '../../../hooks/session/useSession';\nimport { CartPage } from '../../../features/pages/CartPage';\nexport default () => {\n  useSession();\n  return <CartPage />;\n};\n",
    [`${APP}/orders/page.tsx`]: "import { getTranslations } from 'next-intl/server';\nimport { CartPage } from '../../../features/pages/CartPage';\nexport default async () => {\n  await getTranslations('x');\n  return <CartPage />;\n};\n",
  });
  const found = hits(report);
  assert.deepEqual(found.map(item => item.path).sort(), [`${APP}/cart/page.tsx`, `${APP}/layout.tsx`]);
  assert.ok(found.every(item => /is a hook called in a/.test(item.message)));
});
