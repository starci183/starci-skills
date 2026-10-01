/**
 * RuleTester proofs for the front-end project-graph rules of the transport, data, route, client-boundary and hook laws. The
 * findings are judged by the architecture machine over the repository graph and served through ESLint (project-graph.mjs); each
 * block below ports the violating and the passing file trees of the machine specs (tests/architecture-*.spec.mjs).
 *
 *   node --test project-graph.routes.test.mjs
 */
import test from "node:test"
import { projectFixture } from "../be/fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const finding = (extra = {}) => ({ messageId: "finding", ...extra })
/** The finding whose message carries `pattern`. */
const saying = (pattern) => ({ message: pattern })

/** A fixture of the front-end profile and its two case makers: `ok(rel)` is a clean file, `bad(rel, ...errors)` a violating one. */
const repo = (t, files, extra = {}) => {
    const f = projectFixture({ profile: "fe", files, ...extra })
    t.after(() => f.cleanup())
    return {
        tester: f.tester,
        ok: (rel) => ({ filename: f.at(rel), code: files[rel] }),
        bad: (rel, ...errors) => ({ filename: f.at(rel), code: files[rel], errors: errors.length ? errors : [finding()] }),
    }
}

// ------------------------------------------------------------------------------------------------ transport-owner

const API = "apps/web/src/modules/api"
const CLIENT = "export const client = { get: (url: string, signal: AbortSignal) => fetch(url, { signal }) };\n"
const READER = "import { client } from '../client';\nexport const readCourse = (id: string) => client.get(`/courses/${id}`, AbortSignal.timeout(8000));\n"
const OUTCOME = "export type Outcome<T> = { kind: 'ok'; value: T } | { kind: 'refused' };\n"
const GOOD_TRANSPORT = {
    [`${API}/client.ts`]: CLIENT,
    [`${API}/course/read-course.ts`]: READER,
    "apps/web/src/hooks/course/useCourse.ts": "import { readCourse } from '../../modules/api/course/read-course';\nexport const useCourse = (id: string) => readCourse(id);\n",
}
const TWO_APPS = [{ name: "web", kind: "next" }, { name: "admin", kind: "next" }]
const PKG = "packages/shop-api"
const PACKAGE = {
    "tsconfig.json": `${JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "preserve", allowJs: true, skipLibCheck: true, noEmit: true, paths: { "@shop/api": [`${PKG}/src/index.ts`] } },
        include: ["src/**/*", "apps/**/*", "packages/**/*"],
    }, null, 2)}\n`,
    [`${PKG}/package.json`]: JSON.stringify({ name: "@shop/api", private: true }),
    [`${PKG}/tsconfig.json`]: "{}\n",
    [`${PKG}/src/index.ts`]: "export { client } from './client';\nexport type { Outcome } from './outcome';\n",
    [`${PKG}/src/client.ts`]: CLIENT,
    [`${PKG}/src/outcome.ts`]: OUTCOME,
}
const appReader = (app) => ({ [`apps/${app}/src/modules/api/course/read-course.ts`]: "import { client } from '@shop/api';\nexport const readCourse = (id: string) => client.get(`/courses/${id}`, AbortSignal.timeout(8000));\n" })
const NOTHING = (app) => ({ [`apps/${app}/src/hooks/course/useNothing.ts`]: "export const useNothing = () => 1;\n" })
const packaged = (files, apps = TWO_APPS) => ({ apps, declaration: { optionalSlots: ["fe.package.api"] }, files })

test("transport-owner: one client owns the global fetch, no app imports an HTTP library, every reader imports the client", (t) => {
    const files = {
        ...GOOD_TRANSPORT,
        [`${API}/outcome.ts`]: OUTCOME,
        "apps/web/src/hooks/course/useCalled.ts": "export const useCalled = () => fetch('/x');\n",
        "apps/web/src/hooks/course/useMember.ts": "export const useMember = () => globalThis.fetch('/x');\n",
        "apps/web/src/hooks/course/useAliased.ts": "const send = fetch;\nexport const useAliased = () => send('/x');\n",
        "apps/web/src/hooks/course/useSwr.ts": "declare function useSwr(key: string, fetcher: typeof fetch): unknown;\nexport const useSwrCourse = () => useSwr('/x', fetch);\n",
        "apps/web/src/hooks/course/useLocal.ts": "const fetch = (id: string) => id;\nexport const useLocal = () => fetch('1');\n",
        "apps/web/src/hooks/course/useType.ts": "export type Sender = typeof fetch;\nexport type Sent = ReturnType<typeof globalThis.fetch>;\n",
        "apps/web/src/hooks/course/useProperty.ts": "export const useProperty = (repo: { fetch: () => void }) => repo.fetch();\n",
        "apps/web/src/hooks/course/useAxios.ts": "import axios from 'axios';\nexport const useAxios = () => axios;\n",
        "apps/web/src/hooks/course/useKy.ts": "export const useKy = () => import('ky');\n",
        [`${API}/course/read-got.ts`]: "declare function require(name: string): unknown;\nimport { client } from '../client';\nexport const readGot = () => [client, require('got')];\n",
    }
    const { tester, ok, bad } = repo(t, files)
    tester.run("transport-owner", rules["transport-owner"], {
        valid: [
            // the client is the one module that references fetch; readers import it; hooks never touch it
            ok(`${API}/client.ts`), ok(`${API}/course/read-course.ts`), ok("apps/web/src/hooks/course/useCourse.ts"), ok(`${API}/outcome.ts`),
            // a local function named fetch, a type query and a property named fetch are not the global transport
            ok("apps/web/src/hooks/course/useLocal.ts"), ok("apps/web/src/hooks/course/useType.ts"), ok("apps/web/src/hooks/course/useProperty.ts"),
        ],
        invalid: [
            bad("apps/web/src/hooks/course/useCalled.ts"), bad("apps/web/src/hooks/course/useMember.ts"),
            bad("apps/web/src/hooks/course/useAliased.ts"), bad("apps/web/src/hooks/course/useSwr.ts"),
            bad("apps/web/src/hooks/course/useAxios.ts", saying(/axios/)), bad("apps/web/src/hooks/course/useKy.ts", saying(/ky/)),
            bad(`${API}/course/read-got.ts`, saying(/got/)),
        ],
    })
})

test("transport-owner: a reader that does not import the client, and a client that never calls fetch", (t) => {
    const files = {
        ...GOOD_TRANSPORT,
        [`${API}/client.ts`]: "export const client = { get: (url: string) => url };\n",
        [`${API}/course/read-lonely.ts`]: "export const readLonely = () => 1;\n",
    }
    const { tester, ok, bad } = repo(t, files)
    tester.run("transport-owner", rules["transport-owner"], {
        valid: [ok(`${API}/course/read-course.ts`), ok("apps/web/src/hooks/course/useCourse.ts")],
        invalid: [bad(`${API}/course/read-lonely.ts`, saying(/does not import/)), bad(`${API}/client.ts`, saying(/never calls the global fetch/))],
    })
})

test("transport-owner: one client and one Outcome union in the api package, readers in the apps", (t) => {
    const files = {
        ...PACKAGE, ...appReader("web"), ...appReader("admin"),
        "apps/admin/src/hooks/course/useCalled.ts": "export const useCalled = () => fetch('/x');\n",
    }
    const { tester, ok, bad } = repo(t, files, packaged(files))
    tester.run("transport-owner", rules["transport-owner"], {
        valid: [ok(`${PKG}/src/client.ts`), ok(`${PKG}/src/outcome.ts`), ok(`${PKG}/src/index.ts`), ok("apps/web/src/modules/api/course/read-course.ts"), ok("apps/admin/src/modules/api/course/read-course.ts")],
        // a fetch outside the package client is the finding, the client itself is not
        invalid: [bad("apps/admin/src/hooks/course/useCalled.ts")],
    })
})

test("transport-owner: two apps that each keep their own client", (t) => {
    const files = { "apps/web/src/modules/api/client.ts": CLIENT, "apps/admin/src/modules/api/client.ts": CLIENT, ...NOTHING("web") }
    const { tester, ok, bad } = repo(t, files, packaged(files))
    tester.run("transport-owner", rules["transport-owner"], {
        valid: [ok("apps/web/src/hooks/course/useNothing.ts")],
        invalid: [bad("apps/web/src/modules/api/client.ts", saying(/2 transport clients/)), bad("apps/admin/src/modules/api/client.ts", saying(/2 transport clients/))],
    })
})

test("transport-owner: a package client next to an app client", (t) => {
    const files = { ...PACKAGE, "apps/web/src/modules/api/client.ts": CLIENT }
    const { tester, ok, bad } = repo(t, files, packaged(files, [TWO_APPS[0]]))
    tester.run("transport-owner", rules["transport-owner"], {
        valid: [ok(`${PKG}/src/index.ts`), ok(`${PKG}/src/outcome.ts`)],
        invalid: [bad("apps/web/src/modules/api/client.ts"), bad(`${PKG}/src/client.ts`)],
    })
})

test("transport-owner: two apps that keep one app client with no package: the shared client belongs to the package", (t) => {
    const files = { "apps/web/src/modules/api/client.ts": CLIENT, ...NOTHING("admin") }
    const { tester, ok, bad } = repo(t, files, packaged(files))
    tester.run("transport-owner", rules["transport-owner"], {
        valid: [ok("apps/admin/src/hooks/course/useNothing.ts")],
        invalid: [bad("apps/web/src/modules/api/client.ts", saying(/repository of 2 apps/))],
    })
})

test("transport-owner: two Outcome unions, a package one and an app one", (t) => {
    const files = { ...PACKAGE, "apps/web/src/modules/api/outcome.ts": OUTCOME }
    const { tester, ok, bad } = repo(t, files, packaged(files, [TWO_APPS[0]]))
    tester.run("transport-owner", rules["transport-owner"], {
        valid: [ok(`${PKG}/src/client.ts`), ok(`${PKG}/src/index.ts`)],
        invalid: [bad("apps/web/src/modules/api/outcome.ts"), bad(`${PKG}/src/outcome.ts`)],
    })
})

test("transport-owner: an app Outcome union in a two-app repository", (t) => {
    const files = { ...PACKAGE, "apps/admin/src/modules/api/outcome.ts": OUTCOME }
    const { tester, ok, bad } = repo(t, files, packaged(files))
    tester.run("transport-owner", rules["transport-owner"], {
        valid: [ok(`${PKG}/src/client.ts`)],
        invalid: [bad("apps/admin/src/modules/api/outcome.ts"), bad(`${PKG}/src/outcome.ts`)],
    })
})

test("transport-owner: a module that fetches in a repository with no client; a repository with no fetch has nothing to own", (t) => {
    const files = { "apps/web/src/hooks/course/useCalled.ts": "export const useCalled = () => fetch('/x');\n", ...NOTHING("web") }
    const { tester, ok, bad } = repo(t, files, packaged(files))
    tester.run("transport-owner", rules["transport-owner"], {
        valid: [ok("apps/web/src/hooks/course/useNothing.ts")],
        invalid: [bad("apps/web/src/hooks/course/useCalled.ts", saying(/no transport client/))],
    })
})

// ------------------------------------------------------------------------------------------------ swr-data-lifecycle

const lifecycle = {
    schema: "starci/next-data-lifecycle@1",
    swr: { package: "swr", major: 2 },
    hooks: [
        { id: "course-query", path: "src/features/course/use-course.ts", export: "useCourse", kind: "query", resultBinding: "query", identities: [
            { id: "course", binding: "params.courseId", gatesRequest: true, resource: true },
            { id: "viewer", binding: "viewer", gatesRequest: false, resource: false },
        ] },
        { id: "course-mutation", path: "src/features/course/use-course.ts", export: "useCourse", kind: "mutation", resultBinding: "add", identities: [
            { id: "course", binding: "params.courseId", gatesRequest: true, resource: true },
        ] },
        { id: "disabled-fixed-query", path: "src/features/course/use-disabled.ts", export: "useDisabled", kind: "query", identities: [] },
        { id: "lesson-query", path: "src/features/course/use-lesson.ts", export: "useLesson", kind: "query", resultBinding: "query", identities: [
            { id: "lesson", binding: "params.lessonId", gatesRequest: true, resource: true },
            { id: "viewer", binding: "viewer", gatesRequest: false, resource: false },
        ] },
    ],
}
const swrHeader = "import {cache,mutateCache} from '../../shared/cache';\nconst QUERY_COURSE='QUERY_COURSE', MUTATE_COURSE='MUTATE_COURSE';\nconst useViewerKey=():string|undefined=>'viewer';"
const SWR = {
    // the app root's one package.json and its one install
    "../package.json": `${JSON.stringify({
        private: true,
        dependencies: { swr: "^2.3.8" },
        starci: { codePatterns: { next: { schema: "starci/next-code-pattern-contract@1", owners: [], closedVocabularies: [], dataLifecycle: lifecycle } } },
    }, null, 2)}\n`,
    "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", strict: true, jsx: "react-jsx", skipLibCheck: true, noEmit: true }, include: ["src/**/*", "apps/**/*"] }),
    "../node_modules/swr/package.json": JSON.stringify({ name: "swr", version: "2.3.8", types: "./index.d.ts", exports: {
        ".": { types: "./index.d.ts", default: "./index.js" },
        "./immutable": { types: "./immutable.d.ts", default: "./immutable.js" },
        "./mutation": { types: "./mutation.d.ts", default: "./mutation.js" },
        "./package.json": "./package.json",
    } }),
    "../node_modules/swr/index.d.ts": "declare function useSWR<T=unknown>(key:unknown,fetcher?:unknown):{data:T,error?:unknown,mutate:(data?:T)=>Promise<T|undefined>};\nexport default useSWR;\nexport declare function mutate(key:unknown,data?:unknown,options?:unknown):Promise<unknown>;\nexport declare function useSWRConfig():{mutate:typeof mutate};\n",
    "../node_modules/swr/immutable.d.ts": "import useSWR from \"./index\"; export default useSWR;\n",
    "../node_modules/swr/mutation.d.ts": "export default function useSWRMutation<T=unknown>(key:unknown,fetcher?:unknown):{data:T,trigger:(arg?:unknown)=>Promise<T>};\n",
    "../node_modules/swr/index.js": "export default function useSWR(){}; export const mutate=()=>{}; export const useSWRConfig=()=>({mutate});\n",
    "../node_modules/swr/immutable.js": "export {default} from \"./index.js\";\n",
    "../node_modules/swr/mutation.js": "export default function useSWRMutation(){}\n",
    "src/shared/cache.ts": "export {default as cache} from \"swr\"; export {default as mutateCache} from \"swr/mutation\";\n",
    "src/features/course/use-disabled.ts": "import {cache} from '../../shared/cache'; export const useDisabled=()=>cache(null,async()=>null);\n",
    // the former false positives: a transparent alias of an identity and of the params object are the same identity
    "src/features/course/use-lesson.ts": `${swrHeader}
export const useLesson=(params:{lessonId?:string})=>{
  const viewer=useViewerKey(); const viewerAlias=viewer; const p=params;
  const query=cache(()=>p.lessonId===undefined?null:['QUERY_LESSON',p.lessonId,viewerAlias],async()=>null);
  return {query};
};
`,
}

test("swr-data-lifecycle: a key without its viewer identity and a mutation without its resource identity are findings", (t) => {
    const files = {
        ...SWR,
        "src/features/course/use-course.ts": `${swrHeader}
export const useCourse=(params:{courseId?:string})=>{
  const viewer=useViewerKey();
  const query=cache(params.courseId===undefined?null:[QUERY_COURSE,params.courseId],async()=>null);
  const {trigger:add}=mutateCache({operation:MUTATE_COURSE},async()=>null);
  return {query,add,viewer};
};
`,
    }
    const { tester, ok, bad } = repo(t, files)
    tester.run("swr-data-lifecycle", rules["swr-data-lifecycle"], {
        valid: [ok("src/features/course/use-disabled.ts"), ok("src/features/course/use-lesson.ts"), ok("src/shared/cache.ts")],
        invalid: [bad("src/features/course/use-course.ts",
            { ...saying(/^\[FE_SWR_KEY_IDENTITY\] course-query key must include declared identity viewer/), line: 6 },
            { ...saying(/^\[FE_SWR_KEY_IDENTITY\] course-mutation must produce an explicit null key/), line: 7 },
            { ...saying(/^\[FE_SWR_MUTATION_RESOURCE_IDENTITY\]/), line: 7 })],
    })
})

test("swr-data-lifecycle: a disabled fixed query that passes an explicit false key is a finding", (t) => {
    const files = {
        ...SWR,
        "src/features/course/use-course.ts": `${swrHeader}
export const useCourse=(params:{courseId?:string})=>{
  const viewer=useViewerKey();
  const query=cache(params.courseId===undefined?null:[QUERY_COURSE,params.courseId,viewer??'guest'],async()=>null);
  const {trigger:add}=mutateCache(params.courseId===undefined?null:{operation:MUTATE_COURSE,courseId:params.courseId},async()=>null);
  return {query,add};
};
`,
        "src/features/course/use-disabled.ts": "import {cache} from '../../shared/cache'; export const useDisabled=()=>cache(false,async()=>null);\n",
    }
    const { tester, ok, bad } = repo(t, files)
    tester.run("swr-data-lifecycle", rules["swr-data-lifecycle"], {
        // the aliased SWR 2 array and object keys carry every declared identity
        valid: [ok("src/features/course/use-course.ts"), ok("src/features/course/use-lesson.ts")],
        invalid: [bad("src/features/course/use-disabled.ts", saying(/explicit null/))],
    })
})

test("swr-data-lifecycle: a lossy or discarded identity in a key is a finding", (t) => {
    const course = (key) => `${swrHeader}
export const useCourse=(params:{courseId?:string})=>{
  const viewer=useViewerKey();
  const query=cache(${key},async()=>null);
  const {trigger:add}=mutateCache(params.courseId===undefined?null:{operation:MUTATE_COURSE,courseId:params.courseId},async()=>null);
  return {query,add};
};
`
    const files = { ...SWR, "src/features/course/use-course.ts": course("()=>params.courseId===undefined?null:[QUERY_COURSE,params.courseId,(viewer,'same')]") }
    const { tester, ok, bad } = repo(t, files)
    tester.run("swr-data-lifecycle", rules["swr-data-lifecycle"], {
        valid: [ok("src/features/course/use-lesson.ts"), ok("src/features/course/use-disabled.ts")],
        invalid: [bad("src/features/course/use-course.ts")],
    })
})

// ------------------------------------------------------------------------------------------------ route-files-thin

const ROUTES = "apps/web/src/app/[locale]"
const THIN_FEATURES = {
    "apps/web/src/features/layouts/ShopLayout/index.tsx": "export const ShopLayout = (props: { content: unknown }) => <main>{String(props.content)}</main>;\n",
    "apps/web/src/features/layouts/AuthLayout/index.tsx": "export const AuthLayout = () => <section />;\n",
    "apps/web/src/features/pages/CartPage/index.tsx": "export const CartPage = () => <article />;\n",
    "apps/web/src/hooks/session/useSession.ts": "export const useSession = () => 1;\n",
}
/** A route file whose relative imports climb `up` directories to src. */
const layoutAt = (up, body, imports = "") => `import { Shell } from '@fixture/shell';\nimport { ShopLayout } from '${"../".repeat(up)}features/layouts/ShopLayout';\nimport { AuthLayout } from '${"../".repeat(up)}features/layouts/AuthLayout';\n${imports}${body}\n`

test("route-files-thin: a route file mounts one feature and draws nothing, and holds no hook", (t) => {
    const files = {
        ...THIN_FEATURES,
        [`${ROUTES}/layout.tsx`]: layoutAt(2, "const Layout = ({ children }: { children: unknown }) => (\n  <Shell>\n    <ShopLayout content={children} />\n  </Shell>\n);\nexport default Layout;"),
        [`${ROUTES}/loading.tsx`]: "import { LocaleLoading } from '@fixture/shell';\nexport default LocaleLoading;\n",
        [`${ROUTES}/not-found.tsx`]: "import { LocaleNotFound } from '@fixture/shell';\nexport default LocaleNotFound;\n",
        [`${ROUTES}/cart/page.tsx`]: "import { CartPage } from '../../../features/pages/CartPage';\nconst Page = () => <CartPage />;\nexport default Page;\n",
        // a server-side data call is not a hook
        [`${ROUTES}/orders/page.tsx`]: "import { getTranslations } from 'next-intl/server';\nimport { CartPage } from '../../../features/pages/CartPage';\nexport default async () => {\n  await getTranslations('x');\n  return <CartPage />;\n};\n",
        // a host element is drawing
        [`${ROUTES}/host/layout.tsx`]: layoutAt(3, "export default function Layout() {\n  return <div className=\"shell\"><ShopLayout content={null} /></div>;\n}"),
        [`${ROUTES}/host/template.tsx`]: layoutAt(3, "export default function Template() {\n  return <><main /><ShopLayout content={null} /></>;\n}"),
        // an inline component beside the default export
        [`${ROUTES}/inline/not-found.tsx`]: layoutAt(3, "const Message = () => <Shell />;\nconst NotFound = () => <ShopLayout content={<Message />} />;\nexport default NotFound;"),
        // two feature owners, and JSX with no feature
        [`${ROUTES}/two/layout.tsx`]: layoutAt(3, "export default () => (\n  <Shell>\n    <ShopLayout content={null} />\n    <AuthLayout />\n  </Shell>\n);"),
        [`${ROUTES}/empty/loading.tsx`]: layoutAt(3, "export default () => <Shell />;"),
        // a hook called in a route file, page included
        [`${ROUTES}/hook/layout.tsx`]: layoutAt(3, "export default () => {\n  useTranslations('shop');\n  return <ShopLayout content={null} />;\n};", "import { useTranslations } from 'next-intl';\n"),
        [`${ROUTES}/session/page.tsx`]: "import { useSession } from '../../../hooks/session/useSession';\nimport { CartPage } from '../../../features/pages/CartPage';\nexport default () => {\n  useSession();\n  return <CartPage />;\n};\n",
    }
    const { tester, ok, bad } = repo(t, files)
    tester.run("route-files-thin", rules["route-files-thin"], {
        valid: [ok(`${ROUTES}/layout.tsx`), ok(`${ROUTES}/loading.tsx`), ok(`${ROUTES}/not-found.tsx`), ok(`${ROUTES}/cart/page.tsx`), ok(`${ROUTES}/orders/page.tsx`)],
        invalid: [
            bad(`${ROUTES}/host/layout.tsx`, saying(/<div> is drawing/)),
            bad(`${ROUTES}/host/template.tsx`, saying(/<main> is drawing/)),
            bad(`${ROUTES}/inline/not-found.tsx`, saying(/inline component/)),
            bad(`${ROUTES}/two/layout.tsx`), bad(`${ROUTES}/empty/loading.tsx`),
            bad(`${ROUTES}/hook/layout.tsx`, saying(/is a hook called in a/)),
            bad(`${ROUTES}/session/page.tsx`, saying(/is a hook called in a/)),
        ],
    })
})

// ------------------------------------------------------------------------------------------------ route-adapter

const PAGE_OF = "apps/web/src/app"
const HOME = { "apps/web/src/features/pages/HomePage/index.tsx": "export const HomePage = () => <main />;\n" }
const ROUTE = "import { HomePage } from '../../features/pages/HomePage';\nexport default function Route() { return <HomePage />; }\n"

test("route-adapter: a page route is a server adapter mounting one pages-tier component", (t) => {
    const files = {
        ...HOME,
        "apps/web/src/features/pages/AboutPage/index.tsx": "export const AboutPage = () => <main />;\n",
        [`${PAGE_OF}/home/page.tsx`]: ROUTE,
        // a zero-JSX redirect adapter, and a terminal notFound guard, are route adapters
        [`${PAGE_OF}/old/page.tsx`]: "import { redirect } from 'next/navigation';\nexport default function Route() { redirect('/home'); }\n",
        [`${PAGE_OF}/guarded/page.tsx`]: "import { notFound } from 'next/navigation';\nimport { HomePage } from '../../features/pages/HomePage';\nexport default function Route() { if (!HomePage) notFound(); return <HomePage />; }\n",
        // no default export, and a default export that is not a local function
        [`${PAGE_OF}/none/page.tsx`]: "import { HomePage } from '../../features/pages/HomePage';\nexport const Route = () => <HomePage />;\n",
        [`${PAGE_OF}/reexport/page.tsx`]: "export { HomePage as default } from '../../features/pages/HomePage';\n",
        // the client boundary, and a router hook
        [`${PAGE_OF}/client/page.tsx`]: `'use client';\n${ROUTE}`,
        [`${PAGE_OF}/router/page.tsx`]: "import { useRouter } from 'next/navigation';\nimport { HomePage } from '../../features/pages/HomePage';\nexport default function Route() { useRouter(); return <HomePage />; }\n",
        // two pages mounted, or drawing beside the page, and a decision that selects visual composition
        [`${PAGE_OF}/two/page.tsx`]: "import { HomePage } from '../../features/pages/HomePage';\nimport { AboutPage } from '../../features/pages/AboutPage';\nexport default function Route() { return <><HomePage /><AboutPage /></>; }\n",
        [`${PAGE_OF}/drawn/page.tsx`]: "import { HomePage } from '../../features/pages/HomePage';\nexport default function Route() { return <div><HomePage /></div>; }\n",
        [`${PAGE_OF}/choice/page.tsx`]: "import { HomePage } from '../../features/pages/HomePage';\nimport { AboutPage } from '../../features/pages/AboutPage';\nexport default function Route({ flag }: { flag: boolean }) { if (flag) return <AboutPage />; return <HomePage />; }\n",
    }
    const { tester, ok, bad } = repo(t, files)
    tester.run("route-adapter", rules["route-adapter"], {
        valid: [ok(`${PAGE_OF}/home/page.tsx`), ok(`${PAGE_OF}/old/page.tsx`), ok(`${PAGE_OF}/guarded/page.tsx`)],
        invalid: [
            bad(`${PAGE_OF}/none/page.tsx`, saying(/FE_ROUTE_DEFAULT_EXPORT/)),
            bad(`${PAGE_OF}/reexport/page.tsx`, saying(/FE_ROUTE_DEFAULT_EXPORT/)),
            bad(`${PAGE_OF}/client/page.tsx`, saying(/FE_ROUTE_CLIENT_BOUNDARY/)),
            bad(`${PAGE_OF}/router/page.tsx`, saying(/FE_ROUTE_CLIENT_HOOK/)),
            bad(`${PAGE_OF}/two/page.tsx`, saying(/FE_ROUTE_ONE_PAGE/)),
            bad(`${PAGE_OF}/drawn/page.tsx`, saying(/FE_ROUTE_ONE_PAGE/)),
            bad(`${PAGE_OF}/choice/page.tsx`, saying(/FE_ROUTE_ONE_PAGE/), saying(/FE_ROUTE_DRAWING_DECISION/)),
        ],
    })
})

// ------------------------------------------------------------------------------------------------ client-reaches-server

const SERVER_READER = "import 'server-only';\nimport { headers } from 'next/headers';\nexport const readSession = async () => (await headers()).get('x');\n"

test("client-reaches-server: no module reachable from a use client module imports server-only code", (t) => {
    const files = {
        // three hops from a client component to a server reader: the entry carries the finding, for each server import
        "apps/web/src/components/blocks/Cart/index.tsx": "'use client';\nimport { useCart } from '../../../hooks/cart/useCart';\nexport const Cart = () => useCart();\n",
        "apps/web/src/hooks/cart/useCart.ts": "import { loadCart } from '../../modules/cart/load-cart';\nexport const useCart = () => loadCart();\n",
        "apps/web/src/modules/cart/load-cart.ts": "import { session } from './session';\nexport const loadCart = () => session();\n",
        "apps/web/src/modules/cart/session.ts": SERVER_READER,
        // a client module that itself imports a server module or a Node built-in
        "apps/web/src/hooks/a/useA.ts": "'use client';\nimport { NextResponse } from 'next/server';\nexport const useA = () => NextResponse;\n",
        "apps/web/src/hooks/b/useB.ts": "'use client';\nimport { getTranslations } from 'next-intl/server';\nexport const useB = () => getTranslations;\n",
        "apps/web/src/hooks/c/useC.ts": "'use client';\nimport { readFileSync } from 'node:fs';\nexport const useC = () => readFileSync;\n",
        "apps/web/src/hooks/d/useD.ts": "'use client';\nimport { readFileSync } from 'fs';\nexport const useD = () => readFileSync;\n",
        "apps/web/src/hooks/e/useE.ts": "'use client';\nimport { join } from 'path';\nexport const useE = () => join;\n",
        // a server reader reached only from server components, and a client tree free of server imports
        "apps/web/src/app/page.tsx": "import { readSession } from '../modules/order/session';\nexport default async function Page() { return <main>{await readSession()}</main>; }\n",
        "apps/web/src/modules/order/session.ts": SERVER_READER,
        "apps/web/src/components/blocks/Order/index.tsx": "'use client';\nimport { useOrder } from '../../../hooks/order/useOrder';\nexport const Order = () => useOrder();\n",
        "apps/web/src/hooks/order/useOrder.ts": "import { format } from '../../modules/order/format';\nexport const useOrder = () => format(1);\n",
        "apps/web/src/modules/order/format.ts": "export const format = (value: number) => String(value);\n",
        // a type-only import of a server module vanishes at build
        "apps/web/src/components/blocks/Typed/index.tsx": "'use client';\nimport type { Session } from '../../../modules/typed/session';\nimport { type Headers as H } from 'next/headers';\nexport const Typed = (props: { session: Session; h: H }) => props.session;\n",
        "apps/web/src/modules/typed/session.ts": "import type { ReadonlyHeaders } from 'next/headers';\nimport 'server-only';\nexport type Session = { headers: ReadonlyHeaders };\nexport const read = async () => 1;\n",
        "apps/web/src/hooks/typed/useTypes.ts": "'use client';\nimport type { NextRequest } from 'next/server';\nexport type Req = NextRequest;\nexport const useTypes = () => 1;\n",
    }
    const { tester, ok, bad } = repo(t, files)
    tester.run("client-reaches-server", rules["client-reaches-server"], {
        valid: [
            ok("apps/web/src/app/page.tsx"), ok("apps/web/src/modules/order/session.ts"), ok("apps/web/src/components/blocks/Order/index.tsx"),
            ok("apps/web/src/hooks/order/useOrder.ts"), ok("apps/web/src/modules/order/format.ts"),
            ok("apps/web/src/components/blocks/Typed/index.tsx"), ok("apps/web/src/hooks/typed/useTypes.ts"),
            // the chain is reported at the client entry, not on the hops
            ok("apps/web/src/hooks/cart/useCart.ts"), ok("apps/web/src/modules/cart/load-cart.ts"),
        ],
        invalid: [
            bad("apps/web/src/components/blocks/Cart/index.tsx", saying(/server-only/), saying(/next\/headers/)),
            bad("apps/web/src/hooks/a/useA.ts", saying(/next\/server/)),
            bad("apps/web/src/hooks/b/useB.ts", saying(/next-intl\/server/)),
            bad("apps/web/src/hooks/c/useC.ts", saying(/node:fs/)),
            bad("apps/web/src/hooks/d/useD.ts"), bad("apps/web/src/hooks/e/useE.ts"),
        ],
    })
})

// ------------------------------------------------------------------------------------------------ hooks-are-hooks

const HOOKS = "apps/web/src/hooks/course"
const HOOK_FILES = {
    [`${HOOKS}/index.ts`]: "export { useCourse } from './useCourse';\n",
    [`${HOOKS}/useCourse.ts`]: "import { courseKey } from './course.shared';\nexport const useCourse = (id: string) => courseKey(id);\n",
    [`${HOOKS}/useLesson.ts`]: "import { courseKey } from './course.shared';\nexport const useLesson = (id: string) => courseKey(id);\n",
    [`${HOOKS}/course.shared.ts`]: "export const courseKey = (id: string) => `course:${id}`;\n",
}

test("hooks-are-hooks: one shared file named for its domain, and no helper declared in two files of a domain", (t) => {
    const files = {
        ...HOOK_FILES,
        // a shared file named for another domain, and a second shared file
        [`${HOOKS}/cart.shared.ts`]: "export const cartKey = (id: string) => id;\n",
        "apps/web/src/hooks/cart/index.ts": "export { useCart } from './useCart';\n",
        "apps/web/src/hooks/cart/useCart.ts": "const buildKey = (id: string) => id;\nexport const useCart = () => buildKey('c');\n",
        "apps/web/src/hooks/cart/cart.shared.ts": "export const cartId = 1;\n",
        "apps/web/src/hooks/cart/more.shared.ts": "export const moreId = 1;\n",
        // a helper declared in two files of one domain: the finding is at the later file, other domains excepted
        [`${HOOKS}/useA.ts`]: "const buildKey = (id: string) => id;\nexport const useA = () => buildKey('a');\n",
        [`${HOOKS}/useB.ts`]: "function buildKey(id: string) { return id; }\nexport const useB = () => buildKey('b');\n",
    }
    const { tester, ok, bad } = repo(t, files)
    tester.run("hooks-are-hooks", rules["hooks-are-hooks"], {
        valid: [
            ok(`${HOOKS}/index.ts`), ok(`${HOOKS}/useCourse.ts`), ok(`${HOOKS}/useLesson.ts`), ok(`${HOOKS}/course.shared.ts`), ok(`${HOOKS}/useA.ts`),
            ok("apps/web/src/hooks/cart/useCart.ts"), ok("apps/web/src/hooks/cart/cart.shared.ts"),
        ],
        invalid: [
            bad(`${HOOKS}/cart.shared.ts`), bad("apps/web/src/hooks/cart/more.shared.ts"),
            bad(`${HOOKS}/useB.ts`, saying(/also in apps\/web\/src\/hooks\/course\/useA\.ts/)),
        ],
    })
})

// ------------------------------------------------------------------------------------------------ hook-location

const WEB_TSCONFIG = `${JSON.stringify({
    compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "preserve", allowJs: true, skipLibCheck: true, noEmit: true, baseUrl: ".", paths: { "@/*": ["apps/web/src/*"] } },
    include: ["apps/web/src/**/*"],
}, null, 2)}\n`
const HOOK_LAYOUT = {
    "tsconfig.json": WEB_TSCONFIG,
    "apps/web/src/app/page.tsx": "import {HomePage} from \"@/features/pages/HomePage\";const Route=()=> <HomePage/>;export default Route;",
    "apps/web/src/features/pages/HomePage/index.tsx": "import {CatalogBlock} from \"@/components/blocks/catalog/CatalogBlock\";export const HomePage=()=> <CatalogBlock/>;",
    "apps/web/src/components/blocks/catalog/CatalogBlock/index.tsx": "\"use client\";import {useCatalog} from \"@/hooks\";import {CatalogBlockView} from \"./component\";export const CatalogBlock=()=>{const value=useCatalog();return <CatalogBlockView value={value}/>};",
    "apps/web/src/components/blocks/catalog/CatalogBlock/component.tsx": "import {CatalogLeaf} from \"@/components/leaves/CatalogLeaf\";export const CatalogBlockView=({value}:{readonly value:string})=> <CatalogLeaf value={value}/>;",
    // built-in React hooks inside a visual, and a product hook entered through the hooks barrel, are valid
    "apps/web/src/components/leaves/CatalogLeaf/index.tsx": "import {useState} from \"react\";import {useAutoScroll} from \"@/hooks\";export const CatalogLeaf=({value}:{readonly value:string})=>{const ref=useAutoScroll();const [open,setOpen]=useState(false);return <button ref={ref} onClick={()=>setOpen(!open)}>{open?value:\"closed\"}</button>};",
    "apps/web/src/hooks/index.ts": "export {useCatalog} from \"./catalog/use-catalog\";export {useAutoScroll} from \"./ui/use-auto-scroll\";",
    "apps/web/src/hooks/catalog/use-catalog.ts": "import {readCatalog} from \"@/modules/catalog/read-catalog\";export const useCatalog=()=>readCatalog();",
    "apps/web/src/hooks/ui/use-auto-scroll.ts": "import {useRef} from \"react\";export const useAutoScroll=()=>useRef(null);",
    "apps/web/src/modules/catalog/read-catalog.ts": "export const readCatalog=()=>\"ready\";",
}

test("hook-location: a custom hook is defined in the hooks folder and imported through its entry", (t) => {
    const files = {
        ...HOOK_LAYOUT,
        // a custom hook authored outside hooks/ (an alias export of a built-in wrapper)
        "apps/web/src/components/leaves/Intrinsic/index.tsx": "import {useRef} from \"react\";const intrinsic=()=>useRef(null);export {intrinsic as useAutoScroll};",
        // a block that defines its own product hook
        "apps/web/src/components/blocks/catalog/OwnBlock/index.tsx": "import {useCatalog} from \"@/hooks\";const useBlockData=()=>useCatalog();const LocalView=({value}:{value:unknown})=> <span>{String(value)}</span>;export const OwnBlock=()=>{const value=useBlockData();return <LocalView value={value}/>};",
        // a component entering a hook file directly, instead of the barrel
        "apps/web/src/components/leaves/BadUiLeaf/index.tsx": "import {useBadScroll} from \"@/hooks/ui/use-bad-scroll\";export const BadUiLeaf=()=>{const value=useBadScroll();return <span>{value}</span>};",
        "apps/web/src/hooks/ui/use-bad-scroll.ts": "import {readCatalog} from \"@/modules/catalog/read-catalog\";export const useBadScroll=()=>readCatalog();",
    }
    const { tester, ok, bad } = repo(t, files)
    tester.run("hook-location", rules["hook-location"], {
        valid: [
            ok("apps/web/src/components/blocks/catalog/CatalogBlock/index.tsx"), ok("apps/web/src/components/leaves/CatalogLeaf/index.tsx"),
            ok("apps/web/src/hooks/index.ts"), ok("apps/web/src/hooks/catalog/use-catalog.ts"), ok("apps/web/src/hooks/ui/use-auto-scroll.ts"),
            ok("apps/web/src/hooks/ui/use-bad-scroll.ts"),
        ],
        invalid: [
            bad("apps/web/src/components/leaves/Intrinsic/index.tsx", saying(/FE_CUSTOM_HOOK_LOCATION/)),
            bad("apps/web/src/components/blocks/catalog/OwnBlock/index.tsx", saying(/FE_BLOCK_PRODUCT_HOOK_DEFINITION/), saying(/FE_CUSTOM_HOOK_LOCATION/)),
            bad("apps/web/src/components/leaves/BadUiLeaf/index.tsx", saying(/FE_COMPONENT_DEEP_HOOK_IMPORT/)),
        ],
    })
})
