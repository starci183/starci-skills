// proves: FE_OWNER_REACHABLE@lite
// proves: FE_OWNER_REACHABLE@full
// proves: FE_ROUTE_HARDCODED@lite
// proves: FE_ROUTE_HARDCODED@full
// proves: FE_HREF_RESOLVES@lite
// proves: FE_HREF_RESOLVES@full
import test from 'node:test';
import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import { projectFixture } from '../be/fixtures/project/tester.mjs';
import { at, fixtureHfs, LITE_FE_DECLARATION } from './fixtures/typed/tester.mjs';
import { noHardcodedRoute } from './next-conventions.mjs';
import { rules } from './project-graph.mjs';

for (const edition of ['lite', 'full']) {
  test(`${edition} reachable owners and served hrefs pass; orphan owners and dead hrefs fail`, (t) => {
    const files = {
      'apps/web/src/app/[locale]/page.tsx': "import Home from '../../features/pages/home'; export default Home;",
      'apps/web/src/app/[locale]/links/page.tsx': "import Links from '../../../features/pages/links'; export default Links;",
      'apps/web/src/app/[locale]/about/page.tsx': 'export default function About() { return null; }',
      'apps/web/src/features/pages/home/index.tsx': 'export default function Home() { return <a href="/about" />; }',
      'apps/web/src/features/pages/links/index.tsx': 'export default function Links() { return <a href="/missing" />; }',
      'apps/web/src/features/pages/orphan/index.tsx': 'export default function Orphan() { return null; }',
    };
    const fixture = projectFixture({ profile: 'fe', edition, files });
    t.after(fixture.cleanup);
    fixture.tester.run('owner-reachable', rules['owner-reachable'], {
      valid: [{ filename: fixture.at('apps/web/src/features/pages/home/index.tsx'), code: files['apps/web/src/features/pages/home/index.tsx'] }],
      invalid: [
        { filename: fixture.at('apps/web/src/features/pages/links/index.tsx'), code: files['apps/web/src/features/pages/links/index.tsx'], errors: [{ message: /\[FE_HREF_RESOLVES\]/, line: 1 }] },
        { filename: fixture.at('apps/web/src/features/pages/orphan/index.tsx'), code: files['apps/web/src/features/pages/orphan/index.tsx'], errors: [{ message: /\[FE_OWNER_REACHABLE\]/, line: 1 }] },
      ],
    });
  });

  test(`${edition} route builders pass while inline route paths fail`, () => {
    const tester = new RuleTester({
      languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
      settings: { starci: { hfs: fixtureHfs(LITE_FE_DECLARATION, { lite: edition === 'lite' }) } },
    });
    const filename = at('apps/web/src/components/blocks/Nav/index.tsx');
    tester.run('no-hardcoded-route', noHardcodedRoute, {
      valid: [{ filename, code: 'router.push(routes.home());' }],
      invalid: [{ filename, code: 'router.push("/courses");', errors: [{ messageId: 'route' }] }],
    });
  });
}
