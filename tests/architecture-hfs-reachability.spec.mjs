import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-fixture.mjs';

// HFS check 3: reachability. BE features and capability modules must be composed into an app root; FE page features must be
// mounted by a route; FE string-literal hrefs must resolve to a route.

const reach = report => report.coverage.hfsMachine.reachability;

test('BE: a feature the app module imports at runtime is composed', t => {
  const root = archFixture(t, {
    files: {
      'apps/core/src/app.module.ts': "import { FooModule } from '../../../src/features/foo';\nexport const AppModule = [FooModule];\n",
      'src/features/foo/index.ts': "export { FooModule } from './foo.module';\n",
      'src/features/foo/foo.module.ts': 'export class FooModule {}\n',
    },
  });
  const report = runArch(root);
  assert.deepEqual(findings(report, 'BE_FEATURE_NOT_COMPOSED'), []);
  assert.equal(reach(report).status, 'checked');
  assert.equal(reach(report).features, 1);
  assert.equal(reach(report).appRoots, 1);
  assert.equal(reach(report).notComposed, 0);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_FEATURE_NOT_COMPOSED'));
});

test('BE: a feature no app root imports is reported with the roots examined', t => {
  const root = archFixture(t, {
    files: {
      'src/features/orphan/index.ts': "export { OrphanModule } from './orphan.module';\n",
      'src/features/orphan/orphan.module.ts': 'export class OrphanModule {}\n',
    },
  });
  const report = runArch(root);
  const hits = findings(report, 'BE_FEATURE_NOT_COMPOSED');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].path, 'src/features/orphan/index.ts');
  assert.equal(hits[0].owner, 'src/features/orphan');
  assert.deepEqual(hits[0].appRoots, ['apps/core/src']);
  assert.match(hits[0].message, /orphan/);
  assert.equal(reach(report).notComposed, 1);
});

test('BE: a type-only import from the app module does not compose a feature', t => {
  const root = archFixture(t, {
    files: {
      'apps/core/src/app.module.ts': "import type { FooModule } from '../../../src/features/foo';\nexport const AppModule: FooModule | null = null;\n",
      'src/features/foo/index.ts': "export { FooModule } from './foo.module';\n",
      'src/features/foo/foo.module.ts': 'export class FooModule {}\n',
    },
  });
  const hits = findings(runArch(root), 'BE_FEATURE_NOT_COMPOSED');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].owner, 'src/features/foo');
});

test('BE: a capability module reached through a composed feature is composed; an unreached one is BE_MODULE_NOT_COMPOSED', t => {
  const root = archFixture(t, {
    files: {
      'apps/core/src/app.module.ts': "import { FooModule } from '../../../src/features/foo';\nexport const AppModule = [FooModule];\n",
      'src/features/foo/index.ts': "export { FooModule } from './foo.module';\n",
      'src/features/foo/foo.module.ts': "import { BillingModule } from '../../modules/domain/billing';\nexport class FooModule { static imports = [BillingModule]; }\n",
      'src/modules/domain/billing/index.ts': "export { BillingModule } from './billing.module';\n",
      'src/modules/domain/billing/billing.module.ts': "import { mail } from '../../integrations/mail';\nexport class BillingModule { static mail = mail; }\n",
      'src/modules/integrations/mail/index.ts': 'export const mail = 1;\n',
      'src/modules/integrations/unused/index.ts': 'export const unused = 1;\n',
    },
  });
  const report = runArch(root);
  assert.deepEqual(findings(report, 'BE_FEATURE_NOT_COMPOSED'), []);
  const hits = findings(report, 'BE_MODULE_NOT_COMPOSED');
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.equal(hits[0].owner, 'src/modules/integrations/unused');
  assert.equal(hits[0].slot, 'be.integrations');
  assert.equal(reach(report).features, 1);
  assert.equal(reach(report).modules, 3);
  assert.equal(reach(report).notComposed, 1);
});

const FE_ROUTES = {
  'apps/web/src/app/[locale]/page.tsx': "import Home from '../../features/pages/home';\nexport default Home;\n",
  'apps/web/src/app/[locale]/(marketing)/about/page.tsx': 'export default function About() { return null; }\n',
  'apps/web/src/app/[locale]/courses/[id]/page.tsx': 'export default function Course() { return null; }\n',
  'apps/web/src/app/[locale]/docs/[...rest]/page.tsx': 'export default function Docs() { return null; }\n',
};

test('FE: a page feature imported by an app route is mounted', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: { ...FE_ROUTES, 'apps/web/src/features/pages/home/index.tsx': 'export default function Home() { return null; }\n' },
  });
  const report = runArch(root);
  assert.deepEqual(findings(report, 'FE_OWNER_REACHABLE'), []);
  assert.equal(reach(report).status, 'checked');
  assert.equal(reach(report).pages, 1);
  assert.equal(reach(report).mounted, 1);
  assert.equal(reach(report).routes, 4);
  assert.ok(report.coverage.checkedRuleIds.includes('FE_OWNER_REACHABLE'));
});

test('FE: a page feature no route imports (or only imports as a type) is not mounted', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: {
      'apps/web/src/app/[locale]/page.tsx': "import type { Home } from '../../features/pages/home';\nexport default function Page(_: { home?: Home }) { return null; }\n",
      'apps/web/src/features/pages/home/index.tsx': 'export type Home = number;\n',
      'apps/web/src/features/pages/orphan/index.tsx': 'export default function Orphan() { return null; }\n',
    },
  });
  const hits = findings(runArch(root), 'FE_OWNER_REACHABLE');
  assert.deepEqual(hits.map(hit => hit.path).sort(), ['apps/web/src/features/pages/home/index.tsx', 'apps/web/src/features/pages/orphan/index.tsx']);
  assert.equal(hits[0].app, 'web');
});

test('FE: hrefs that match a route resolve; locale, route groups, dynamic segments and template literals are transparent', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: {
      ...FE_ROUTES,
      'apps/web/src/features/pages/home/index.tsx': [
        "import { redirect } from 'next/navigation';",
        'export default function Home({ id, computed }: { id: string; computed: string }) {',
        "  redirect('/about');",
        '  return (',
        '    <div>',
        '      <a href="/about">a</a>',
        '      <a href={`/courses/${id}?tab=1`}>b</a>',
        '      <a href="/en/about#top">c</a>',
        '      <a href="/">d</a>',
        '      <a href="/docs/a/b/c">e</a>',
        '      <a href={computed}>f</a>',
        '      <a href="https://example.com">g</a>',
        '      <a href="/logo.png">h</a>',
        '    </div>',
        '  );',
        '}',
        '',
      ].join('\n'),
    },
  });
  const report = runArch(root);
  assert.deepEqual(findings(report, 'FE_HREF_RESOLVES'), []);
  assert.equal(reach(report).hrefs, 9);
  assert.equal(reach(report).hrefsResolved, 6);
  assert.equal(reach(report).hrefsSkipped, 3);
});

test('FE: an href, redirect or router.push target no route serves is FE_HREF_RESOLVES with the href and location', t => {
  const root = archFixture(t, {
    profile: 'fe',
    files: {
      ...FE_ROUTES,
      'apps/web/src/features/pages/home/index.tsx': [
        'export default function Home({ id }: { id: string }) {',
        '  const router = { push(_: string) {} };',
        "  router.push('/nowhere');",
        '  return (',
        '    <div>',
        '      <a href="/about">ok</a>',
        '      <a href="/missing">bad</a>',
        '      <a href={`/courses/${id}/lessons`}>bad template</a>',
        '    </div>',
        '  );',
        '}',
        '',
      ].join('\n'),
    },
  });
  const report = runArch(root);
  const hits = findings(report, 'FE_HREF_RESOLVES');
  assert.deepEqual(hits.map(hit => hit.href).sort(), ['/courses/${…}/lessons', '/missing', '/nowhere']);
  const missing = hits.find(hit => hit.href === '/missing');
  assert.equal(missing.path, 'apps/web/src/features/pages/home/index.tsx');
  assert.equal(missing.line, 7);
  assert.equal(missing.app, 'web');
  assert.match(missing.message, /\/missing/);
  assert.equal(reach(report).hrefs, 4);
  assert.equal(reach(report).hrefsResolved, 1);
  assert.ok(report.coverage.checkedRuleIds.includes('FE_HREF_RESOLVES'));
});
