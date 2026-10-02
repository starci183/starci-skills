import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// Route adapters and pure components of a front end: FE_ROUTE_DEFAULT_EXPORT, FE_ROUTE_CLIENT_BOUNDARY, FE_ROUTE_CLIENT_HOOK,
// FE_PURE_WORLD_IMPORT. Each has a violating and a passing tree.
const PAGE = 'apps/web/src/app/home/page.tsx';
const CLIENT_PAGE = 'apps/web/src/app/client/page.tsx';
const HOOK_PAGE = 'apps/web/src/app/router/page.tsx';
const NONE_PAGE = 'apps/web/src/app/none/page.tsx';
const REEXPORT_PAGE = 'apps/web/src/app/reexport/page.tsx';
const SERVER_PAGE = 'apps/web/src/app/server/page.tsx';
const GUARDED_PAGE = 'apps/web/src/app/guarded/page.tsx';
const HOME = { 'apps/web/src/features/pages/HomePage/index.tsx': 'export const HomePage = () => <main />;\n' };
const ROUTE = "import { HomePage } from '../../features/pages/HomePage';\nexport default function Route() { return <HomePage />; }\n";
const ROUTER_COMPONENT = 'apps/web/src/components/blocks/home/Router/component.tsx';
const INTL_COMPONENT = 'apps/web/src/components/blocks/home/Intl/component.tsx';
const TYPED_COMPONENT = 'apps/web/src/components/blocks/home/Typed/component.tsx';
const PLAIN_COMPONENT = 'apps/web/src/components/blocks/home/Plain/component.tsx';
const CONNECTED_COMPONENT = 'apps/web/src/components/blocks/home/Plain/index.tsx';
const FILES = {
  ...HOME,
  [PAGE]: ROUTE,
  [CLIENT_PAGE]: `'use client';\n${ROUTE}`,
  [HOOK_PAGE]: `import { useRouter } from 'next/navigation';\nimport { HomePage } from '../../features/pages/HomePage';\nexport default function Route() { useRouter(); return <HomePage />; }\n`,
  [NONE_PAGE]: "import { HomePage } from '../../features/pages/HomePage';\nexport const Route = () => <HomePage />;\n",
  [REEXPORT_PAGE]: "export { HomePage as default } from '../../features/pages/HomePage';\n",
  [SERVER_PAGE]: ROUTE,
  [GUARDED_PAGE]: "import { notFound } from 'next/navigation';\nimport { HomePage } from '../../features/pages/HomePage';\nexport default function Route() { if (!HomePage) notFound(); return <HomePage />; }\n",
  [ROUTER_COMPONENT]: "import { useRouter } from 'next/navigation';\nexport const Router = () => { useRouter(); return <div />; };\n",
  [INTL_COMPONENT]: "import { useTranslations } from 'next-intl';\nexport const Intl = () => { useTranslations(); return <div />; };\n",
  [TYPED_COMPONENT]: "import type { AppRouterInstance } from 'next/navigation';\nexport const Typed = (props: { router: AppRouterInstance }) => <div>{String(props.router)}</div>;\n",
  [PLAIN_COMPONENT]: 'export const Plain = () => <div />;\n',
  [CONNECTED_COMPONENT]: "import { useRouter } from 'next/navigation';\nimport { Plain } from './component';\nexport const Connected = () => { useRouter(); return <Plain />; };\n",
};
let sharedReport;
const run = (t, paths) => {
  sharedReport ??= runArch(archFixture(t, { profile: 'fe', files: FILES }));
  const selected = new Set(paths);
  return { ...sharedReport, violations: sharedReport.violations.filter(item => selected.has(item.path)) };
};
const only = (report, id) => findings(report, id).map(item => item.path);

test('a page.tsx that default-exports one local route function raises none of the route findings', t => {
  const report = run(t, [PAGE]);
  for (const id of ['FE_ROUTE_DEFAULT_EXPORT', 'FE_ROUTE_CLIENT_BOUNDARY', 'FE_ROUTE_CLIENT_HOOK']) assert.deepEqual(only(report, id), [], id);
  for (const id of ['FE_ROUTE_DEFAULT_EXPORT', 'FE_ROUTE_CLIENT_BOUNDARY', 'FE_ROUTE_CLIENT_HOOK', 'FE_PURE_WORLD_IMPORT']) assert.ok(report.coverage.checkedRuleIds.includes(id), id);
});

test('a page.tsx with no default export, or a default export that is not a local function, is FE_ROUTE_DEFAULT_EXPORT', t => {
  const report = run(t, [NONE_PAGE, REEXPORT_PAGE]);
  assert.deepEqual(only(report, 'FE_ROUTE_DEFAULT_EXPORT').sort(), [NONE_PAGE, REEXPORT_PAGE]);
});

test('a page.tsx that carries the use client directive is FE_ROUTE_CLIENT_BOUNDARY; one without it is not', t => {
  const report = run(t, [CLIENT_PAGE, SERVER_PAGE]);
  assert.deepEqual(only(report, 'FE_ROUTE_CLIENT_BOUNDARY'), [CLIENT_PAGE]);
});

test('a page.tsx that imports a router hook from next/navigation is FE_ROUTE_CLIENT_HOOK; redirect and notFound are not', t => {
  const report = run(t, [HOOK_PAGE, GUARDED_PAGE]);
  assert.deepEqual(only(report, 'FE_ROUTE_CLIENT_HOOK'), [HOOK_PAGE]);
});

test('a pure component.tsx that imports next/navigation or next-intl is FE_PURE_WORLD_IMPORT; its connected index.tsx, a type-only import and a component with neither are not', t => {
  const report = run(t, [ROUTER_COMPONENT, INTL_COMPONENT, TYPED_COMPONENT, PLAIN_COMPONENT, CONNECTED_COMPONENT]);
  assert.deepEqual(only(report, 'FE_PURE_WORLD_IMPORT').sort(), [INTL_COMPONENT, ROUTER_COMPONENT]);
});
