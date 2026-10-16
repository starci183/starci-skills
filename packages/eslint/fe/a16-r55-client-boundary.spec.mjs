// proves: FE_CLIENT_BOUNDARY@lite
// proves: FE_CLIENT_BOUNDARY@full
// proves: FE_CLIENT_SERVER_IMPORT@lite
// proves: FE_CLIENT_SERVER_IMPORT@full
// proves: FE_CLIENT_REACHES_SERVER@lite
// proves: FE_CLIENT_REACHES_SERVER@full
// proves: FE_SERVER_ONLY_MARK@lite
// proves: FE_SERVER_ONLY_MARK@full
// proves: FE_STORAGE_OUTSIDE_MODULES@lite
// proves: FE_STORAGE_OUTSIDE_MODULES@full
// proves: FE_DANGEROUS_HTML@lite
// proves: FE_DANGEROUS_HTML@full
import test from 'node:test';
import { projectFixture } from '../be/fixtures/project/tester.mjs';
import {
  clientNoServerImport,
  noDangerousHtml,
  serverModuleMarksServerOnly,
  useClientOnlyAtBoundary,
  webStorageOnlyInModules,
} from './client-boundary.mjs';
import { rules as graphRules } from './project-graph.mjs';

for (const edition of ['lite', 'full']) {
  test(`R55 ${edition}: valid and invalid client boundaries and browser surfaces`, (t) => {
    const fixture = projectFixture({ profile: 'fe', edition });
    t.after(fixture.cleanup);
    fixture.tester.run('use-client-only-at-boundary', useClientOnlyAtBoundary, {
      valid: [
        { filename: fixture.at('apps/web/src/components/blocks/Feed/index.tsx'), code: '"use client"; export const Feed = () => null;' },
        { filename: fixture.at('apps/web/src/features/pages/Home/index.tsx'), code: 'export const Home = () => null;' },
        // A page owner stays a server component and renders the client block that carries the directive.
        { filename: fixture.at('apps/web/src/features/pages/Home/index.tsx'), code: 'import { Feed } from "@/components/blocks/Feed"; export const Home = () => <Feed />;' },
      ],
      invalid: [
        { filename: fixture.at('apps/web/src/features/pages/Home/index.tsx'), code: '"use client"; export const Home = () => null;', errors: [{ messageId: 'slot', data: { slot: 'page owner' } }] },
        { filename: fixture.at('apps/web/src/features/layouts/Shell/index.tsx'), code: '"use client"; export const Shell = () => null;', errors: [{ messageId: 'slot', data: { slot: 'layout owner' } }] },
        { filename: fixture.at('apps/web/src/app/page.tsx'), code: '"use client"; export default function Page() { return null; }', errors: [{ messageId: 'slot' }] },
        { filename: fixture.at('apps/web/src/components/blocks/Feed/component.tsx'), code: '"use client"; export const FeedView = () => null;', errors: [{ messageId: 'elsewhere' }] },
      ],
    });
    fixture.tester.run('client-no-server-import', clientNoServerImport, {
      valid: [
        { filename: fixture.at('apps/web/src/components/blocks/Feed/index.tsx'), code: '"use client"; import type { NextRequest } from "next/server";' },
        { filename: fixture.at('apps/web/src/features/pages/Home/index.tsx'), code: 'import { headers } from "next/headers";' },
      ],
      invalid: [
        { filename: fixture.at('apps/web/src/components/blocks/Feed/index.tsx'), code: '"use client"; import { headers } from "next/headers";', errors: [{ messageId: 'server' }] },
        { filename: fixture.at('apps/web/src/components/blocks/Feed/index.tsx'), code: '"use client"; import fs from "node:fs";', errors: [{ messageId: 'server' }] },
      ],
    });
    fixture.tester.run('server-module-marks-server-only', serverModuleMarksServerOnly, {
      valid: [
        { filename: fixture.at('apps/web/src/modules/session/read-session.ts'), code: 'import "server-only"; import { headers } from "next/headers"; export const readSession = () => headers();' },
        { filename: fixture.at('apps/web/src/modules/session/read-session.ts'), code: 'import type { NextRequest } from "next/server"; export type SessionRequest = NextRequest;' },
      ],
      invalid: [
        { filename: fixture.at('apps/web/src/modules/session/read-session.ts'), code: 'import { headers } from "next/headers"; export const readSession = () => headers();', errors: [{ messageId: 'mark' }] },
        { filename: fixture.at('apps/web/src/modules/session/read-session.ts'), code: 'import { headers } from "next/headers"; import "server-only"; export const readSession = () => headers();', errors: [{ messageId: 'mark' }] },
      ],
    });
    fixture.tester.run('web-storage-only-in-modules', webStorageOnlyInModules, {
      valid: [
        { filename: fixture.at('apps/web/src/modules/storage/index.ts'), code: 'export const readTheme = () => window.localStorage.getItem("theme");' },
      ],
      invalid: [
        { filename: fixture.at('apps/web/src/components/blocks/Feed/index.tsx'), code: 'const theme = window.localStorage.getItem("theme");', errors: [{ messageId: 'storage' }] },
        { filename: fixture.at('apps/web/src/hooks/session/useSession.ts'), code: 'sessionStorage.setItem("session", "value");', errors: [{ messageId: 'storage' }] },
      ],
    });
    fixture.tester.run('no-dangerous-html', noDangerousHtml, {
      valid: [
        { filename: fixture.at('apps/web/src/components/leaves/StructuredData/index.tsx'), code: 'export const StructuredData = () => <script dangerouslySetInnerHTML={{ __html: JSON_LD }} />;' },
      ],
      invalid: [
        { filename: fixture.at('apps/web/src/components/leaves/Article/index.tsx'), code: 'export const Article = () => <article dangerouslySetInnerHTML={{ __html: text }} />;', errors: [{ messageId: 'html' }] },
      ],
    });
  });

  test(`R55 ${edition}: valid runtime and type-only client graphs reject a transitive server import`, (t) => {
    const files = {
      'apps/web/src/components/blocks/Good/index.tsx': '"use client"; import { format } from "../../../modules/format"; export const Good = () => format(1);',
      'apps/web/src/modules/format/index.ts': 'export const format = (value: number) => String(value);',
      'apps/web/src/components/blocks/Bad/index.tsx': '"use client"; import { useSession } from "../../../hooks/session/useSession"; export const Bad = () => useSession();',
      'apps/web/src/hooks/session/useSession.ts': 'import { readSession } from "../../modules/session"; export const useSession = () => readSession();',
      'apps/web/src/modules/session/index.ts': 'import "server-only"; export type Session = { id: string }; export const readSession = () => "session";',
      'apps/web/src/components/blocks/Typed/index.tsx': '"use client"; import type { Session } from "../../../modules/session"; export const Typed = (props: { session: Session }) => props.session.id;',
      'apps/web/src/features/pages/Server/index.tsx': 'import { readSession } from "../../../modules/session"; export const Server = () => readSession();',
    };
    const fixture = projectFixture({ profile: 'fe', edition, files });
    t.after(fixture.cleanup);
    fixture.tester.run('client-reaches-server', graphRules['client-reaches-server'], {
      valid: [
        { filename: fixture.at('apps/web/src/components/blocks/Good/index.tsx'), code: files['apps/web/src/components/blocks/Good/index.tsx'] },
        { filename: fixture.at('apps/web/src/components/blocks/Typed/index.tsx'), code: files['apps/web/src/components/blocks/Typed/index.tsx'] },
        { filename: fixture.at('apps/web/src/features/pages/Server/index.tsx'), code: files['apps/web/src/features/pages/Server/index.tsx'] },
      ],
      invalid: [
        { filename: fixture.at('apps/web/src/components/blocks/Bad/index.tsx'), code: files['apps/web/src/components/blocks/Bad/index.tsx'], errors: [{ message: /FE_CLIENT_REACHES_SERVER/ }] },
      ],
    });
  });
}
