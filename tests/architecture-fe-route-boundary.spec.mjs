import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-fixture.mjs';

// Route adapters and pure components of a front end: FE_ROUTE_DEFAULT_EXPORT, FE_ROUTE_CLIENT_BOUNDARY, FE_ROUTE_CLIENT_HOOK,
// FE_PURE_WORLD_IMPORT. Each has a violating and a passing tree.
const PAGE = 'apps/web/src/app/home/page.tsx';
const HOME = { 'apps/web/src/features/pages/HomePage/index.tsx': 'export const HomePage = () => <main />;\n' };
const ROUTE = "import { HomePage } from '../../features/pages/HomePage';\nexport default function Route() { return <HomePage />; }\n";
const run = (t, files) => runArch(archFixture(t, { profile: 'fe', files: { ...HOME, ...files } }));
const only = (report, id) => findings(report, id).map(item => item.path);

test('a page.tsx that default-exports one local route function raises none of the route findings', t => {
  const report = run(t, { [PAGE]: ROUTE });
  for (const id of ['FE_ROUTE_DEFAULT_EXPORT', 'FE_ROUTE_CLIENT_BOUNDARY', 'FE_ROUTE_CLIENT_HOOK']) assert.deepEqual(only(report, id), [], id);
  for (const id of ['FE_ROUTE_DEFAULT_EXPORT', 'FE_ROUTE_CLIENT_BOUNDARY', 'FE_ROUTE_CLIENT_HOOK', 'FE_PURE_WORLD_IMPORT']) assert.ok(report.coverage.checkedRuleIds.includes(id), id);
});

test('a page.tsx with no default export, or a default export that is not a local function, is FE_ROUTE_DEFAULT_EXPORT', t => {
  const report = run(t, {
    'apps/web/src/app/none/page.tsx': "import { HomePage } from '../../features/pages/HomePage';\nexport const Route = () => <HomePage />;\n",
    'apps/web/src/app/reexport/page.tsx': "export { HomePage as default } from '../../features/pages/HomePage';\n",
  });
  assert.deepEqual(only(report, 'FE_ROUTE_DEFAULT_EXPORT').sort(), ['apps/web/src/app/none/page.tsx', 'apps/web/src/app/reexport/page.tsx']);
});

test('a page.tsx that carries the use client directive is FE_ROUTE_CLIENT_BOUNDARY; one without it is not', t => {
  const report = run(t, { [PAGE]: `'use client';\n${ROUTE}`, 'apps/web/src/app/server/page.tsx': ROUTE });
  assert.deepEqual(only(report, 'FE_ROUTE_CLIENT_BOUNDARY'), [PAGE]);
});

test('a page.tsx that imports a router hook from next/navigation is FE_ROUTE_CLIENT_HOOK; redirect and notFound are not', t => {
  const report = run(t, {
    [PAGE]: `import { useRouter } from 'next/navigation';\nimport { HomePage } from '../../features/pages/HomePage';\nexport default function Route() { useRouter(); return <HomePage />; }\n`,
    'apps/web/src/app/guarded/page.tsx': "import { notFound } from 'next/navigation';\nimport { HomePage } from '../../features/pages/HomePage';\nexport default function Route() { if (!HomePage) notFound(); return <HomePage />; }\n",
  });
  assert.deepEqual(only(report, 'FE_ROUTE_CLIENT_HOOK'), [PAGE]);
});

test('a pure component.tsx that imports next/navigation or next-intl is FE_PURE_WORLD_IMPORT; its connected index.tsx, a type-only import and a component with neither are not', t => {
  const report = run(t, {
    'apps/web/src/components/blocks/home/Router/component.tsx': "import { useRouter } from 'next/navigation';\nexport const Router = () => { useRouter(); return <div />; };\n",
    'apps/web/src/components/blocks/home/Intl/component.tsx': "import { useTranslations } from 'next-intl';\nexport const Intl = () => { useTranslations(); return <div />; };\n",
    'apps/web/src/components/blocks/home/Typed/component.tsx': "import type { AppRouterInstance } from 'next/navigation';\nexport const Typed = (props: { router: AppRouterInstance }) => <div>{String(props.router)}</div>;\n",
    'apps/web/src/components/blocks/home/Plain/component.tsx': 'export const Plain = () => <div />;\n',
    'apps/web/src/components/blocks/home/Plain/index.tsx': "import { useRouter } from 'next/navigation';\nimport { Plain } from './component';\nexport const Connected = () => { useRouter(); return <Plain />; };\n",
  });
  assert.deepEqual(only(report, 'FE_PURE_WORLD_IMPORT').sort(), ['apps/web/src/components/blocks/home/Intl/component.tsx', 'apps/web/src/components/blocks/home/Router/component.tsx']);
});
