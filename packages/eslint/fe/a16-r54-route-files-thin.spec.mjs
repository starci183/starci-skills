// proves: FE_ROUTE_FILES_THIN@lite
// proves: FE_ROUTE_FILES_THIN@full
// proves: FE_NEXT_CONVENTIONS@lite
// proves: FE_NEXT_CONVENTIONS@full
// proves: FE_PAGE_METADATA_MISSING@lite
// proves: FE_PAGE_METADATA_MISSING@full
// proves: FE_ROUTE_ONE_PAGE@lite
// proves: FE_ROUTE_ONE_PAGE@full
// proves: FE_ROUTE_DRAWING_DECISION@lite
// proves: FE_ROUTE_DRAWING_DECISION@full
// proves: FE_ROUTE_CLIENT_BOUNDARY@lite
// proves: FE_ROUTE_CLIENT_BOUNDARY@full
// proves: FE_ROUTE_CLIENT_HOOK@lite
// proves: FE_ROUTE_CLIENT_HOOK@full
// proves: FE_ROUTE_DEFAULT_EXPORT@lite
// proves: FE_ROUTE_DEFAULT_EXPORT@full
import test from "node:test"
import { projectFixture } from "../be/fixtures/project/tester.mjs"
import { noMiddlewareFile, pageExportsMetadata } from "./next-conventions.mjs"
import { rules } from "./project-graph.mjs"

const APP = "apps/web/src/app"
const LOCALE = `${APP}/[locale]`
const HOME = "import { HomePage } from '../../features/pages/HomePage';\nexport default function Route() { return <HomePage />; }\n"
const layoutAt = (up, body) => `import { Shell } from '@fixture/shell';\nimport { ShopLayout } from '${"../".repeat(up)}features/layouts/ShopLayout';\n${body}\n`

for (const edition of ["lite", "full"]) {
    test(`R54 ${edition}: valid proxy and invalid retired middleware file`, (t) => {
        const files = {
            "apps/web/src/proxy.ts": "export function proxy(request) { return request }\n",
            "apps/web/src/middleware.ts": "export function middleware() {}\n",
        }
        const fixture = projectFixture({ profile: "fe", edition, files })
        t.after(() => fixture.cleanup())
        fixture.tester.run("no-middleware-file", noMiddlewareFile, {
            valid: [{ filename: fixture.at("apps/web/src/proxy.ts"), code: files["apps/web/src/proxy.ts"] }],
            invalid: [{ filename: fixture.at("apps/web/src/middleware.ts"), code: files["apps/web/src/middleware.ts"], errors: [{ messageId: "file" }] }],
        })
    })

    test(`R54 ${edition}: valid page metadata and invalid missing page metadata`, (t) => {
        const files = {
            [`${LOCALE}/page.tsx`]: "export const metadata = { title: 'Home' };\nexport default function Page() {}\n",
            [`${LOCALE}/missing/page.tsx`]: "export default function Page() {}\n",
        }
        const fixture = projectFixture({ profile: "fe", edition, files })
        t.after(() => fixture.cleanup())
        fixture.tester.run("page-exports-metadata", pageExportsMetadata, {
            valid: [{ filename: fixture.at(`${LOCALE}/page.tsx`), code: files[`${LOCALE}/page.tsx`] }],
            invalid: [{ filename: fixture.at(`${LOCALE}/missing/page.tsx`), code: files[`${LOCALE}/missing/page.tsx`], errors: [{ messageId: "metadata" }] }],
        })
    })

    test(`R54 ${edition}: valid thin routes and invalid route drawing or hooks`, (t) => {
        const files = {
            "apps/web/src/features/layouts/ShopLayout/index.tsx": "export const ShopLayout = (props: { content: unknown }) => <main>{String(props.content)}</main>;\n",
            "apps/web/src/features/pages/CartPage/index.tsx": "export const CartPage = () => <article />;\n",
            "apps/web/src/hooks/session/useSession.ts": "export const useSession = () => 1;\n",
            [`${LOCALE}/layout.tsx`]: layoutAt(2, "const Layout = ({ children }: { children: unknown }) => <Shell><ShopLayout content={children} /></Shell>;\nexport default Layout;"),
            [`${LOCALE}/loading.tsx`]: "import { LocaleLoading } from '@fixture/shell';\nexport default LocaleLoading;\n",
            [`${LOCALE}/cart/page.tsx`]: "import { CartPage } from '../../../features/pages/CartPage';\nexport default function Page() { return <CartPage />; }\n",
            [`${LOCALE}/host/layout.tsx`]: layoutAt(3, "export default function Layout() { return <div><ShopLayout content={null} /></div>; }"),
            [`${LOCALE}/session/page.tsx`]: "import { useSession } from '../../../hooks/session/useSession';\nimport { CartPage } from '../../../features/pages/CartPage';\nexport default function Page() { useSession(); return <CartPage />; }\n",
        }
        const fixture = projectFixture({ profile: "fe", edition, files })
        t.after(() => fixture.cleanup())
        fixture.tester.run("route-files-thin", rules["route-files-thin"], {
            valid: [
                { filename: fixture.at(`${LOCALE}/layout.tsx`), code: files[`${LOCALE}/layout.tsx`] },
                { filename: fixture.at(`${LOCALE}/loading.tsx`), code: files[`${LOCALE}/loading.tsx`] },
                { filename: fixture.at(`${LOCALE}/cart/page.tsx`), code: files[`${LOCALE}/cart/page.tsx`] },
            ],
            invalid: [
                { filename: fixture.at(`${LOCALE}/host/layout.tsx`), code: files[`${LOCALE}/host/layout.tsx`], errors: [{ message: /FE_ROUTE_FILES_THIN.*<div> is drawing/ }] },
                { filename: fixture.at(`${LOCALE}/session/page.tsx`), code: files[`${LOCALE}/session/page.tsx`], errors: [{ message: /FE_ROUTE_FILES_THIN.*is a hook called in a/ }] },
            ],
        })
    })

    test(`R54 ${edition}: valid server page adapters and invalid adapter responsibilities`, (t) => {
        const files = {
            "apps/web/src/features/pages/HomePage/index.tsx": "export const HomePage = () => <main />;\n",
            "apps/web/src/features/pages/AboutPage/index.tsx": "export const AboutPage = () => <main />;\n",
            [`${APP}/home/page.tsx`]: HOME,
            [`${APP}/old/page.tsx`]: "import { redirect } from 'next/navigation';\nexport default function Route() { redirect('/home'); }\n",
            [`${APP}/guarded/page.tsx`]: "import { notFound } from 'next/navigation';\nimport { HomePage } from '../../features/pages/HomePage';\nexport default function Route() { if (!HomePage) notFound(); return <HomePage />; }\n",
            [`${APP}/none/page.tsx`]: "import { HomePage } from '../../features/pages/HomePage';\nexport const Route = () => <HomePage />;\n",
            [`${APP}/client/page.tsx`]: `'use client';\n${HOME}`,
            [`${APP}/router/page.tsx`]: "import { useRouter } from 'next/navigation';\nimport { HomePage } from '../../features/pages/HomePage';\nexport default function Route() { useRouter(); return <HomePage />; }\n",
            [`${APP}/two/page.tsx`]: "import { HomePage } from '../../features/pages/HomePage';\nimport { AboutPage } from '../../features/pages/AboutPage';\nexport default function Route() { return <><HomePage /><AboutPage /></>; }\n",
            [`${APP}/choice/page.tsx`]: "import { HomePage } from '../../features/pages/HomePage';\nimport { AboutPage } from '../../features/pages/AboutPage';\nexport default function Route({ flag }: { flag: boolean }) { if (flag) return <AboutPage />; return <HomePage />; }\n",
        }
        const fixture = projectFixture({ profile: "fe", edition, files })
        t.after(() => fixture.cleanup())
        fixture.tester.run("route-adapter", rules["route-adapter"], {
            valid: [
                { filename: fixture.at(`${APP}/home/page.tsx`), code: files[`${APP}/home/page.tsx`] },
                { filename: fixture.at(`${APP}/old/page.tsx`), code: files[`${APP}/old/page.tsx`] },
                { filename: fixture.at(`${APP}/guarded/page.tsx`), code: files[`${APP}/guarded/page.tsx`] },
            ],
            invalid: [
                { filename: fixture.at(`${APP}/none/page.tsx`), code: files[`${APP}/none/page.tsx`], errors: [{ message: /FE_ROUTE_DEFAULT_EXPORT/ }] },
                { filename: fixture.at(`${APP}/client/page.tsx`), code: files[`${APP}/client/page.tsx`], errors: [{ message: /FE_ROUTE_CLIENT_BOUNDARY/ }] },
                { filename: fixture.at(`${APP}/router/page.tsx`), code: files[`${APP}/router/page.tsx`], errors: [{ message: /FE_ROUTE_CLIENT_HOOK/ }] },
                { filename: fixture.at(`${APP}/two/page.tsx`), code: files[`${APP}/two/page.tsx`], errors: [{ message: /FE_ROUTE_ONE_PAGE/ }] },
                { filename: fixture.at(`${APP}/choice/page.tsx`), code: files[`${APP}/choice/page.tsx`], errors: [{ message: /FE_ROUTE_ONE_PAGE/ }, { message: /FE_ROUTE_DRAWING_DECISION/ }] },
            ],
        })
    })
}
