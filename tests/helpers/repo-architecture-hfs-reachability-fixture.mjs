import { archFixture, runArch } from './hfs-arch-fixture.mjs';

const BE_APPS = [
  { name: 'composed', kind: 'api' },
  { name: 'orphan', kind: 'api' },
  { name: 'type-only', kind: 'api' },
  { name: 'capability', kind: 'api' },
];

const BE_PATHS = {
  composedFeature: 'src/features/api/composed/index.ts',
  composedOwner: 'src/features/api/composed',
  orphanFeature: 'src/features/api/orphan/index.ts',
  orphanOwner: 'src/features/api/orphan',
  typeOnlyOwner: 'src/features/api/type-only',
  unusedOwner: 'src/modules/integrations/unused',
};

const BE_FILES = {
  'apps/composed/src/app.module.ts': "import { ComposedModule } from '../../../src/features/api/composed';\nexport const AppModule = [ComposedModule];\n",
  [BE_PATHS.composedFeature]: "export { ComposedModule } from './composed.module';\n",
  'src/features/api/composed/composed.module.ts': 'export class ComposedModule {}\n',

  [BE_PATHS.orphanFeature]: "export { OrphanModule } from './orphan.module';\n",
  'src/features/api/orphan/orphan.module.ts': 'export class OrphanModule {}\n',
  'apps/orphan/src/app.module.ts': 'export const AppModule = 1;\n',

  'apps/type-only/src/app.module.ts': "import type { TypeOnlyModule } from '../../../src/features/api/type-only';\nexport const AppModule: TypeOnlyModule | null = null;\n",
  'src/features/api/type-only/index.ts': "export { TypeOnlyModule } from './type-only.module';\n",
  'src/features/api/type-only/type-only.module.ts': 'export class TypeOnlyModule {}\n',

  'apps/capability/src/app.module.ts': "import { CapabilityModule } from '../../../src/features/api/capability';\nexport const AppModule = [CapabilityModule];\n",
  'src/features/api/capability/index.ts': "export { CapabilityModule } from './capability.module';\n",
  'src/features/api/capability/capability.module.ts': "import { BillingModule } from '../../../modules/domain/billing';\nexport class CapabilityModule { static imports = [BillingModule]; }\n",
  'src/modules/domain/billing/index.ts': "export { BillingModule } from './billing.module';\n",
  'src/modules/domain/billing/billing.module.ts': "import { mail } from '../../integrations/mail';\nexport class BillingModule { static mail = mail; }\n",
  'src/modules/integrations/mail/index.ts': 'export const mail = 1;\n',
  'src/modules/integrations/unused/index.ts': 'export const unused = 1;\n',
};

const FE_APPS = {
  mounted: 'mounted',
  typeOnly: 'type-only',
  hrefOk: 'href-ok',
  hrefBad: 'href-bad',
};

function routes(app) {
  return {
    [`apps/${app}/src/app/[locale]/page.tsx`]: "import Home from '../../features/pages/home';\nexport default Home;\n",
    [`apps/${app}/src/app/[locale]/(marketing)/about/page.tsx`]: 'export default function About() { return null; }\n',
    [`apps/${app}/src/app/[locale]/courses/[id]/page.tsx`]: 'export default function Course() { return null; }\n',
    [`apps/${app}/src/app/[locale]/docs/[...rest]/page.tsx`]: 'export default function Docs() { return null; }\n',
  };
}

const FE_FILES = {
  ...routes(FE_APPS.mounted),
  [`apps/${FE_APPS.mounted}/src/features/pages/home/index.tsx`]: 'export default function Home() { return null; }\n',

  [`apps/${FE_APPS.typeOnly}/src/app/[locale]/page.tsx`]: "import type { Home } from '../../features/pages/home';\nexport default function Page(_: { home?: Home }) { return null; }\n",
  [`apps/${FE_APPS.typeOnly}/src/features/pages/home/index.tsx`]: 'export type Home = number;\n',
  [`apps/${FE_APPS.typeOnly}/src/features/pages/orphan/index.tsx`]: 'export default function Orphan() { return null; }\n',

  ...routes(FE_APPS.hrefOk),
  [`apps/${FE_APPS.hrefOk}/src/features/pages/home/index.tsx`]: [
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

  ...routes(FE_APPS.hrefBad),
  [`apps/${FE_APPS.hrefBad}/src/features/pages/home/index.tsx`]: [
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
};

/** Build two immutable, path-disjoint scenario graphs and run each through the real architecture entry once. */
export function reachabilityFixture() {
  const cleanups = [];
  const t = { after: cleanup => cleanups.push(cleanup) };
  try {
    const beRoot = archFixture(t, { apps: BE_APPS, files: BE_FILES });
    const feRoot = archFixture(t, {
      profile: 'fe',
      apps: Object.values(FE_APPS).map(name => ({ name, kind: 'next' })),
      files: FE_FILES,
    });
    return {
      be: { report: runArch(beRoot), paths: BE_PATHS },
      fe: { report: runArch(feRoot), apps: FE_APPS },
      close() {
        for (const cleanup of cleanups.reverse()) cleanup();
        cleanups.length = 0;
      },
    };
  } catch (error) {
    for (const cleanup of cleanups.reverse()) cleanup();
    throw error;
  }
}
