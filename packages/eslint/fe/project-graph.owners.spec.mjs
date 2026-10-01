/**
 * RuleTester proofs of the front-end project rules that judge owners: where an owner sits, what it imports, what reaches it.
 * The findings come from the architecture machine over the project graph (scripts/hfs/architecture); each rule reports the
 * findings of its codes on the file ESLint visits. The trees below are the violating and the passing trees of
 * tests/architecture-*.spec.mjs, written to a hermetic repository (hfs.json, tsconfig, the files listed).
 *
 *   node --test project-graph.owners.spec.mjs
 */
import test from "node:test"
import { projectFixture } from "../be/fixtures/project/tester.mjs"
import { rules } from "./project-graph.mjs"

const TWO_APPS = [{ name: "web", kind: "next" }, { name: "admin", kind: "next" }]

/** A repository of `files` with `good(rel)` (a clean case) and `bad(rel, ...lines)` (one finding on each line named). */
const scene = (t, { files, ...options }) => {
    const f = projectFixture({ profile: "fe", files, ...options })
    t.after(f.cleanup)
    const at = (rel) => {
        if (files[rel] === undefined) throw new Error(`${rel} is not a file of this scene`)
        return { filename: f.at(rel), code: files[rel] }
    }
    return {
        tester: f.tester,
        good: (rel) => at(rel),
        bad: (rel, ...lines) => ({ ...at(rel), errors: lines.map((line) => ({ messageId: "finding", line })) }),
    }
}

// ---- owner-reachable (FE_OWNER_REACHABLE, FE_HREF_RESOLVES) -----------------------------------------------------------------

const ROUTES = {
    "apps/web/src/app/[locale]/page.tsx": "import Home from '../../features/pages/home';\nexport default function Route() { return <Home />; }\n",
    "apps/web/src/app/[locale]/links/page.tsx": "import Links from '../../../features/pages/links';\nexport default function Route() { return <Links />; }\n",
    "apps/web/src/app/[locale]/nav/page.tsx": "import Nav from '../../../features/pages/nav';\nexport default function Route() { return <Nav />; }\n",
    "apps/web/src/app/[locale]/(marketing)/about/page.tsx": "export default function About() { return null; }\n",
    "apps/web/src/app/[locale]/courses/[id]/page.tsx": "export default function Course() { return null; }\n",
    "apps/web/src/app/[locale]/docs/[...rest]/page.tsx": "export default function Docs() { return null; }\n",
    "apps/web/src/app/[locale]/typed/page.tsx": "import type { Home } from '../../../features/pages/typed';\nexport default function Route(_: { home?: Home }) { return null; }\n",
}

test("FE_OWNER_REACHABLE, FE_HREF_RESOLVES: a page owner a route mounts and an href a route serves pass; an unmounted owner and a dead href do not", (t) => {
    const s = scene(t, {
        files: {
            ...ROUTES,
            // every href form the machine resolves: literal, redirect, template, locale prefix, hash, root, catch-all; skipped: computed, external, asset
            "apps/web/src/features/pages/links/index.tsx": [
                "import { redirect } from 'next/navigation';",
                "export default function Links({ id, computed }: { id: string; computed: string }) {",
                "  redirect('/about');",
                "  return (",
                "    <div>",
                '      <a href="/about">a</a>',
                "      <a href={`/courses/${id}?tab=1`}>b</a>",
                '      <a href="/en/about#top">c</a>',
                '      <a href="/">d</a>',
                '      <a href="/docs/a/b/c">e</a>',
                "      <a href={computed}>f</a>",
                '      <a href="https://example.com">g</a>',
                '      <a href="/logo.png">h</a>',
                "    </div>",
                "  )",
                "}",
                "",
            ].join("\n"),
            "apps/web/src/features/pages/home/index.tsx": [
                "export default function Home({ id }: { id: string }) {",
                "  return (",
                "    <div>",
                '      <a href="/about">ok</a>',
                '      <a href="/missing">bad</a>',
                "      <a href={`/courses/${id}/lessons`}>bad template</a>",
                "    </div>",
                "  )",
                "}",
                "",
            ].join("\n"),
            "apps/web/src/features/pages/nav/index.tsx": [
                "export default function Nav() {",
                "  const router = { push(_: string) {} }",
                "  router.push('/nowhere')",
                "  return null",
                "}",
                "",
            ].join("\n"),
            // a page no route imports, and a page a route imports only as a type, are not mounted
            "apps/web/src/features/pages/orphan/index.tsx": "export default function Orphan() { return null }\n",
            "apps/web/src/features/pages/typed/index.tsx": "export type Home = number\n",
        },
    })
    s.tester.run("owner-reachable", rules["owner-reachable"], {
        valid: [
            s.good("apps/web/src/features/pages/links/index.tsx"),
            s.good("apps/web/src/app/[locale]/page.tsx"),
            s.good("apps/web/src/app/[locale]/(marketing)/about/page.tsx"),
        ],
        invalid: [
            s.bad("apps/web/src/features/pages/home/index.tsx", 5, 6),
            s.bad("apps/web/src/features/pages/nav/index.tsx", 3),
            s.bad("apps/web/src/features/pages/orphan/index.tsx", 1),
            s.bad("apps/web/src/features/pages/typed/index.tsx", 1),
        ],
    })
})

// ---- tier-direction (FE_TIER_DIRECTION) -------------------------------------------------------------------------------------

test("FE_TIER_DIRECTION: an import goes only to a tier the slot matrix allows", (t) => {
    const s = scene(t, {
        files: {
            // feature to feature is forbidden; feature to modules is fine
            "apps/web/src/features/pages/A/index.tsx": "import { b } from '../B'\nimport { m } from '../../../modules/i18n'\nexport const A = [b, m]\n",
            "apps/web/src/features/pages/B/index.tsx": "export const b = 1\n",
            "apps/web/src/modules/i18n/index.ts": "export const m = 1\n",
            // a route may mount a feature
            "apps/web/src/app/[locale]/page.tsx": "import { A } from '../../features/pages/A'\nexport default function Route() { return A }\n",
            // a component layer imports only the layers after it; a component may import config but not the api transport
            "apps/web/src/components/blocks/Card/index.tsx": "import { Btn } from '../../leaves/Btn'\nexport const Card = Btn\n",
            "apps/web/src/components/leaves/Btn/index.tsx": "import { Card } from '../../blocks/Card'\nimport { c } from '../../../modules/config'\nimport { call } from '../../../modules/api'\nexport const Btn = [Card, c, call]\n",
            "apps/web/src/modules/config/index.ts": "export const c = 1\n",
            "apps/web/src/modules/api/index.ts": "export const call = 1\n",
            // a hook reaches the transport and another domain (through its index)
            "apps/web/src/hooks/shop/index.ts": "import { call } from '../../modules/api'\nimport { useCart } from '../cart'\nexport const useShop = [call, useCart]\n",
            "apps/web/src/hooks/cart/index.ts": "export const useCart = 1\n",
            // a module may not import a hook
            "apps/web/src/modules/catalog/types.ts": "import { useCart } from '../../hooks/cart'\nexport type CatalogValue = ReturnType<typeof useCart>\n",
        },
    })
    s.tester.run("tier-direction", rules["tier-direction"], {
        valid: [
            s.good("apps/web/src/modules/i18n/index.ts"),
            s.good("apps/web/src/app/[locale]/page.tsx"),
            s.good("apps/web/src/components/blocks/Card/index.tsx"),
            s.good("apps/web/src/hooks/shop/index.ts"),
            s.good("apps/web/src/hooks/cart/index.ts"),
        ],
        invalid: [
            s.bad("apps/web/src/features/pages/A/index.tsx", 1),
            s.bad("apps/web/src/components/leaves/Btn/index.tsx", 1, 3),
            s.bad("apps/web/src/modules/catalog/types.ts", 1),
        ],
    })
})

// ---- app-isolation (FE_APP_ISOLATION) ---------------------------------------------------------------------------------------

test("FE_APP_ISOLATION: an app never imports another app", (t) => {
    const s = scene(t, {
        apps: TWO_APPS,
        files: {
            "apps/web/src/features/pages/A/index.tsx": "import { z } from '../../../../../admin/src/modules/z'\nexport const A = z\n",
            "apps/admin/src/modules/z/index.ts": "export const z = 1\n",
            "apps/web/src/features/pages/C/index.tsx": "import { m } from '../../../modules/m'\nexport const C = m\n",
            "apps/web/src/modules/m/index.ts": "export const m = 1\n",
        },
    })
    s.tester.run("app-isolation", rules["app-isolation"], {
        valid: [
            // one app importing its own modules is not an isolation finding
            s.good("apps/web/src/features/pages/C/index.tsx"),
            s.good("apps/web/src/modules/m/index.ts"),
            s.good("apps/admin/src/modules/z/index.ts"),
        ],
        invalid: [s.bad("apps/web/src/features/pages/A/index.tsx", 1)],
    })
})

// ---- owner-cycle (ARCH_OWNER_CYCLE) -----------------------------------------------------------------------------------------

test("ARCH_OWNER_CYCLE: owners that import each other form a cycle, a type-only edge included; an acyclic chain is clean", (t) => {
    const s = scene(t, {
        files: {
            "apps/web/src/modules/x/index.ts": "import { y } from '../y'\nexport const x = [y]\n",
            "apps/web/src/modules/y/index.ts": "import type { X } from '../x'\nexport const y = 1\nexport type Y = X\n",
            "apps/web/src/modules/a/index.ts": "import { b } from '../b'\nexport const a = [b]\n",
            "apps/web/src/modules/b/index.ts": "import { c } from '../c'\nexport const b = [c]\n",
            "apps/web/src/modules/c/index.ts": "export const c = 1\n",
        },
    })
    s.tester.run("owner-cycle", rules["owner-cycle"], {
        valid: [
            s.good("apps/web/src/modules/a/index.ts"),
            s.good("apps/web/src/modules/b/index.ts"),
            s.good("apps/web/src/modules/c/index.ts"),
        ],
        invalid: [s.bad("apps/web/src/modules/x/index.ts", 1)],
    })
})

// ---- owner-export-bypass (ARCH_OWNER_EXPORT_BYPASS, ARCH_OWNER_EXPORT_STAR) -------------------------------------------------

test("ARCH_OWNER_EXPORT_BYPASS, ARCH_OWNER_EXPORT_STAR: another owner is imported through its index entry only, and an entry never uses export star", (t) => {
    const s = scene(t, {
        files: {
            "apps/web/src/hooks/orders/index.ts": "import { call } from '../../modules/api'\nimport { useCart } from '../cart'\nimport { deep } from '../cart/useDeep'\nexport const useOrders = [call, useCart, deep]\n",
            "apps/web/src/hooks/cart/index.ts": "export { useCart } from './useCart'\n",
            "apps/web/src/hooks/cart/useCart.ts": "import { deep } from './useDeep'\nexport const useCart = deep\n",
            "apps/web/src/hooks/cart/useDeep.ts": "export const deep = 1\n",
            "apps/web/src/hooks/shop/index.ts": "import { useCart } from '../cart'\nexport const useShop = useCart\n",
            "apps/web/src/modules/api/index.ts": "export const call = 1\n",
            "apps/web/src/hooks/dom/index.ts": "export * from './useDom'\n",
            "apps/web/src/hooks/dom/useDom.ts": "export const useDom = 1\n",
        },
    })
    s.tester.run("owner-export-bypass", rules["owner-export-bypass"], {
        valid: [
            // through the entry, inside the owner, and to the transport entry
            s.good("apps/web/src/hooks/shop/index.ts"),
            s.good("apps/web/src/hooks/cart/useCart.ts"),
            s.good("apps/web/src/hooks/cart/index.ts"),
            s.good("apps/web/src/modules/api/index.ts"),
        ],
        invalid: [
            s.bad("apps/web/src/hooks/orders/index.ts", 3),
            s.bad("apps/web/src/hooks/dom/index.ts", 1),
        ],
    })
})

// ---- frontend-source-layout (FE_SOURCE_LAYOUT_INVALID) ----------------------------------------------------------------------

const ACCEPTED = {
    "apps/web/src/app/page.tsx": 'import { HomePage } from "../features/pages/HomePage"\nexport default function Route() { return <HomePage /> }\n',
    "apps/web/src/features/pages/HomePage/index.tsx": 'import { CatalogBlock } from "../../../components/blocks/catalog/CatalogBlock"\nexport const HomePage = () => <CatalogBlock />\n',
    "apps/web/src/components/blocks/catalog/CatalogBlock/index.tsx": '"use client"\nimport { useCatalog } from "../../../../hooks"\nimport { CatalogBlockView } from "./component"\nexport const CatalogBlock = () => {\n  const value = useCatalog()\n  return <CatalogBlockView value={value} />\n}\n',
    "apps/web/src/components/blocks/catalog/CatalogBlock/component.tsx": 'import { CatalogLeaf } from "../../../leaves/CatalogLeaf"\nexport const CatalogBlockView = ({ value }: { readonly value: string }) => <CatalogLeaf value={value} />\n',
    "apps/web/src/components/leaves/CatalogLeaf/index.tsx": 'import { useState } from "react"\nimport { useAutoScroll } from "../../../hooks"\nexport const CatalogLeaf = ({ value }: { readonly value: string }) => {\n  const ref = useAutoScroll()\n  const [open, setOpen] = useState(false)\n  return <button ref={ref} onClick={() => setOpen(!open)}>{open ? value : "closed"}</button>\n}\n',
    "apps/web/src/hooks/index.ts": 'export { useCatalog } from "./catalog/use-catalog"\nexport { useAutoScroll } from "./ui/use-auto-scroll"\n',
    "apps/web/src/hooks/catalog/use-catalog.ts": 'import { readCatalog } from "../../modules/catalog/read-catalog"\nexport const useCatalog = () => readCatalog()\n',
    "apps/web/src/hooks/ui/use-auto-scroll.ts": 'import { useRef } from "react"\nexport const useAutoScroll = () => useRef(null)\n',
    "apps/web/src/modules/catalog/read-catalog.ts": 'export const readCatalog = () => "ready"\n',
}

test("FE_SOURCE_LAYOUT_INVALID: a source file sits in a tier folder; the framework-pinned root files are thin adapters, not layout findings", (t) => {
    const s = scene(t, {
        files: {
            ...ACCEPTED,
            "apps/web/src/middleware.ts": 'import { routing } from "./modules/i18n/routing"\nexport default function middleware() { return routing("x") }\nexport const config = { matcher: ["/"] }\n',
            "apps/web/src/instrumentation.ts": 'import { register as start } from "./modules/telemetry/register"\nexport function register() { start() }\n',
            "apps/web/src/instrumentation-client.ts": "export const onRouterTransitionStart = () => undefined\n",
            "apps/web/src/proxy.ts": 'export const config = { matcher: ["/"] }\nexport function proxy() { return null }\n',
            "apps/web/src/modules/i18n/routing.ts": "export const routing = (value: string) => value\n",
            "apps/web/src/modules/telemetry/register.ts": "export const register = () => undefined\n",
            "apps/web/src/app/instrumentation.ts": "export function register() {}\n",
            // a hook sits below a domain folder, never directly under hooks
            "apps/web/src/hooks/use-thing.ts": "export const useThing = () => 1\n",
            // only blocks, composites, branches and leaves sit in components
            "apps/web/src/components/pages/Legacy/index.tsx": "export const Legacy = () => <main />\n",
            // everything else at the source root is refused
            "apps/web/src/config.ts": "export const config = 1\n",
            "apps/web/src/server.ts": "export const server = () => null\n",
            "apps/web/src/i18n/request.ts": 'export const request = () => "vi"\n',
            "apps/web/src/lib/middleware.ts": "export const nested = () => null\n",
            "apps/web/src/middleware/standalone-self-proxy.ts": "export const selfProxy = () => false\n",
        },
    })
    s.tester.run("frontend-source-layout", rules["frontend-source-layout"], {
        valid: [
            ...Object.keys(ACCEPTED).map((rel) => s.good(rel)),
            s.good("apps/web/src/middleware.ts"),
            s.good("apps/web/src/instrumentation.ts"),
            s.good("apps/web/src/instrumentation-client.ts"),
            s.good("apps/web/src/proxy.ts"),
            // a file under app/ is a route-root file, judged as before
            s.good("apps/web/src/app/instrumentation.ts"),
        ],
        invalid: [
            s.bad("apps/web/src/hooks/use-thing.ts", 1),
            s.bad("apps/web/src/components/pages/Legacy/index.tsx", 1),
            s.bad("apps/web/src/config.ts", 1),
            s.bad("apps/web/src/server.ts", 1),
            s.bad("apps/web/src/i18n/request.ts", 1),
            s.bad("apps/web/src/lib/middleware.ts", 1),
            s.bad("apps/web/src/middleware/standalone-self-proxy.ts", 1),
        ],
    })
})

// ---- component-purity ---------------------------------------------------------------------------------------------------------

test("component-purity: a pure component reaches no data or world state, its connected entry owns them", (t) => {
    const s = scene(t, {
        files: {
            ...ACCEPTED,
            "apps/web/src/hooks/index.ts": 'export { useCatalog } from "./catalog/use-catalog"\nexport { useAutoScroll } from "./ui/use-auto-scroll"\nexport { useThing } from "./swr/useThing"\n',
            "apps/web/src/hooks/swr/useThing.ts": 'import { query } from "../../modules/api/query"\nexport const useThing = () => query()\n',
            "apps/web/src/modules/api/query.ts": "export const query = () => 1\n",
            "apps/web/src/bridge.ts": 'export { useThing } from "./hooks"\n',
            // a world owner that draws inline, captures its state, or chooses between a connected and a pure child
            "apps/web/src/components/blocks/demo/Inline/index.tsx": 'import { useThing } from "../../../../hooks"\nconst read = useThing\nexport const Inline = () => {\n  const value = read()\n  return <div>{value}</div>\n}\n',
            "apps/web/src/components/blocks/demo/Captured/index.tsx": 'import { useThing } from "../../../../hooks"\nexport const Captured = () => {\n  const value = useThing()\n  const View = () => <span>{value}</span>\n  return <View />\n}\n',
            "apps/web/src/components/blocks/demo/Child/index.tsx": 'import { useThing } from "../../../../hooks"\nimport { ChildView } from "./view"\nexport const Child = () => {\n  const value = useThing()\n  return <ChildView value={value} />\n}\n',
            "apps/web/src/components/blocks/demo/Child/view.tsx": "export const ChildView = ({ value }: { value: string }) => <span>{value}</span>\n",
            "apps/web/src/components/blocks/demo/Parent/index.tsx": 'import { useThing } from "../../../../hooks"\nimport { Child } from "../Child"\nimport { ChildView } from "../Child/view"\nexport const Parent = () => {\n  const value = useThing()\n  return value === "child" ? <Child /> : <ChildView value={value} />\n}\n',
            // a pure component that reaches a hook, a world hook or a world import
            "apps/web/src/components/blocks/demo/Pure/component.tsx": '"use client"\nimport { useContext } from "react"\nimport { query } from "../../../../bridge"\nexport const Pure = () => {\n  useContext(null as never)\n  return <div>{query()}</div>\n}\n',
            "apps/web/src/components/blocks/home/Router/component.tsx": "import { useRouter } from 'next/navigation'\nexport const Router = () => {\n  useRouter()\n  return <div />\n}\n",
            "apps/web/src/components/blocks/home/Intl/component.tsx": "import { useTranslations } from 'next-intl'\nexport const Intl = () => {\n  useTranslations()\n  return <div />\n}\n",
            // clean: a type-only import, a component with none, its connected entry, an intrinsic leaf
            "apps/web/src/components/blocks/home/Typed/component.tsx": "import type { AppRouterInstance } from 'next/navigation'\nexport const Typed = (props: { router: AppRouterInstance }) => <div>{String(props.router)}</div>\n",
            "apps/web/src/components/blocks/home/Plain/component.tsx": "export const Plain = () => <div />\n",
            "apps/web/src/components/blocks/home/Plain/index.tsx": "import { useRouter } from 'next/navigation'\nimport { Plain } from './component'\nexport const Connected = () => {\n  useRouter()\n  return <Plain />\n}\n",
            "apps/web/src/components/leaves/Disclosure/index.tsx": 'import { useEffect, useRef, useState } from "react"\nexport const Disclosure = () => {\n  const ref = useRef(null)\n  const [open, setOpen] = useState(false)\n  useEffect(() => {}, [])\n  return <button ref={ref} onClick={() => setOpen(!open)}>{open}</button>\n}\n',
            // a leaf that owns product-world state
            "apps/web/src/components/leaves/WorldLeaf/index.tsx": 'import { useThing } from "../../../hooks"\nexport const WorldLeaf = () => {\n  const value = useThing()\n  return <span>{value}</span>\n}\n',
        },
    })
    s.tester.run("component-purity", rules["component-purity"], {
        valid: [
            s.good("apps/web/src/components/blocks/catalog/CatalogBlock/index.tsx"),
            s.good("apps/web/src/components/blocks/catalog/CatalogBlock/component.tsx"),
            s.good("apps/web/src/components/leaves/CatalogLeaf/index.tsx"),
            s.good("apps/web/src/components/blocks/home/Typed/component.tsx"),
            s.good("apps/web/src/components/blocks/home/Plain/component.tsx"),
            s.good("apps/web/src/components/blocks/home/Plain/index.tsx"),
            s.good("apps/web/src/components/leaves/Disclosure/index.tsx"),
        ],
        invalid: [
            s.bad("apps/web/src/components/blocks/demo/Inline/index.tsx", 3, 3),
            s.bad("apps/web/src/components/blocks/demo/Captured/index.tsx", 2, 2),
            s.bad("apps/web/src/components/blocks/demo/Parent/index.tsx", 4, 4),
            s.bad("apps/web/src/components/blocks/demo/Pure/component.tsx", 2, 3, 4, 4),
            s.bad("apps/web/src/components/blocks/home/Router/component.tsx", 1, 2, 2),
            s.bad("apps/web/src/components/blocks/home/Intl/component.tsx", 1, 2, 2),
            s.bad("apps/web/src/components/leaves/WorldLeaf/index.tsx", 2, 2),
        ],
    })
})

// ---- dead-exports (HFS_UNUSED_EXPORT, HFS_UNUSED_FILE) ----------------------------------------------------------------------

test("HFS_UNUSED_EXPORT, HFS_UNUSED_FILE: an owner export a production file outside imports and a file a root reaches pass; the rest are dead", (t) => {
    const s = scene(t, {
        files: {
            "apps/web/src/app/[locale]/page.tsx": "import Home from '../../features/pages/home'\nexport default function Route() { return <Home /> }\n",
            "apps/web/src/features/pages/home/index.tsx": [
                "import { used } from '../../../modules/x'",
                "import * as ns from '../../../modules/ns'",
                "import type { Shape } from '../../../modules/typed'",
                "import renamed from '../../../modules/fallback'",
                "export default function Home() {",
                "  const shape: Shape = { a: 1 }",
                "  const lazy = () => import('../../../modules/lazy')",
                "  return <p>{[used, ns, shape, lazy, renamed].length}</p>",
                "}",
                "",
            ].join("\n"),
            "apps/web/src/modules/x/index.ts": "export const used = 1\nexport const unused = 2\nexport function alsoUnused() { return 3 }\n",
            // a namespace import and a dynamic import use every export; a type-only import uses the export it names
            "apps/web/src/modules/ns/index.ts": "export const one = 1\nexport const two = 2\n",
            "apps/web/src/modules/lazy/index.ts": "export const one = 1\nexport const two = 2\n",
            "apps/web/src/modules/typed/index.ts": "export type Shape = { a: number }\nexport type Other = string\n",
            // a default export is used by a default import
            "apps/web/src/modules/fallback/index.ts": "export default 1\n",
            // a file no root reaches, and one a framework config names by string
            "apps/web/src/components/leaves/Dead/index.tsx": "export const Dead = 1\n",
            "apps/web/src/modules/i18n/request.ts": "export default {}\n",
            "apps/web/next.config.ts": "const request = './src/modules/i18n/request.ts'\nexport default { request }\n",
        },
    })
    s.tester.run("dead-exports", rules["dead-exports"], {
        valid: [
            s.good("apps/web/src/app/[locale]/page.tsx"),
            s.good("apps/web/src/features/pages/home/index.tsx"),
            s.good("apps/web/src/modules/ns/index.ts"),
            s.good("apps/web/src/modules/lazy/index.ts"),
            s.good("apps/web/src/modules/fallback/index.ts"),
            s.good("apps/web/src/modules/i18n/request.ts"),
        ],
        invalid: [
            s.bad("apps/web/src/modules/x/index.ts", 2, 3),
            s.bad("apps/web/src/modules/typed/index.ts", 2),
            s.bad("apps/web/src/components/leaves/Dead/index.tsx", 1, 1),
        ],
    })
})

// ---- duplicate-code (HFS_DUPLICATE_CODE) ------------------------------------------------------------------------------------

/** A function of `statements + 4` lines whose body is a run of line shapes that never repeats within 77 statements. */
const helper = (name, statements, { literal = 1, variable = "value" } = {}) => {
    const chain = (i) => ` + ${literal}`.repeat(i % 7)
    const patterns = [
        (i) => `  const ${variable}${i} = input.items[${i}] ?? ${literal}${chain(i)};`,
        (i) => `  if (${variable}${i - 1} > ${literal + i}${chain(i)}) total += ${variable}${i - 1};`,
        (i) => `  total = total * ${literal + 2} + ${i}${chain(i)};`,
        (i) => `  for (const entry of input.items) { total += entry * ${literal + i}${chain(i)}; }`,
        (i) => `  while (total > ${literal + i}${chain(i)}) total -= ${i};`,
        (i) => `  total = Math.max(total, input.items.length + ${literal + i}${chain(i)});`,
        (i) => `  input.items.push(total % ${literal + i + 1}${chain(i)});`,
        (i) => `  total += input.items.reduce((sum, item) => sum + item * ${literal + i}${chain(i)}, 0);`,
        (i) => `  if (!input.items.length) return ${literal + i}${chain(i)};`,
        (i) => `  total = input.items.map((item) => item + ${literal + i}${chain(i)}).length;`,
        (i) => `  try { total += JSON.parse(String(${i}${chain(i)})); } catch { total = ${literal}; }`,
    ]
    const body = Array.from({ length: statements }, (_, i) => patterns[i % patterns.length](i))
    return `export function ${name}(input: { items: number[] }) {\n  let total = 0;\n${body.join("\n")}\n  return total;\n}\n`
}

test("HFS_DUPLICATE_CODE: a block copied with renamed identifiers and changed literals is a finding; a short copy and a different structure are not", (t) => {
    const s = scene(t, {
        files: {
            "apps/web/src/modules/alpha/index.ts": `import { z } from 'zod'\n\n${helper("compute", 26)}`,
            "apps/web/src/modules/beta/index.ts": `import { z } from 'zod'\n\n${helper("calculate", 26, { literal: 9, variable: "item" })}`,
            // a 7-line clone is below the threshold of 8 lines
            "apps/web/src/modules/small-a/index.ts": helper("tiny", 3),
            "apps/web/src/modules/small-b/index.ts": helper("little", 3, { variable: "item" }),
            // the same size, another structure
            "apps/web/src/modules/shape/index.ts": `export function shape(input: string[]) {\n${Array.from({ length: 30 }, (_, i) => `  for (const entry of input) { if (entry.length > ${i}) { console.log(entry); } }`).join("\n")}\n}\n`,
        },
    })
    s.tester.run("duplicate-code", rules["duplicate-code"], {
        valid: [
            s.good("apps/web/src/modules/small-a/index.ts"),
            s.good("apps/web/src/modules/small-b/index.ts"),
            s.good("apps/web/src/modules/shape/index.ts"),
        ],
        invalid: [s.bad("apps/web/src/modules/alpha/index.ts", 3)],
    })
})

// ---- duplicate-symbol (HFS_DUPLICATE_SYMBOL) --------------------------------------------------------------------------------

test("HFS_DUPLICATE_SYMBOL: a public name another file also declares is a finding; a re-export of one declaration and a default export are not", (t) => {
    const s = scene(t, {
        files: {
            "apps/web/src/hooks/cart/index.ts": "export { useThing } from './useThing'\n",
            "apps/web/src/hooks/cart/useThing.ts": "export const useThing = () => 1\n",
            "apps/web/src/hooks/orders/useThing.ts": "export const useThing = () => 2\n",
            // a function, a type and an enum declared again under a public name are duplicates whatever their kind
            "apps/web/src/modules/kinds/index.ts": "export type { Shape } from './shape'\nexport { Kind } from './kind'\n",
            "apps/web/src/modules/kinds/shape.ts": "export interface Shape { a: number }\n",
            "apps/web/src/modules/kinds/kind.ts": "export enum Kind { A = 'a' }\n",
            "apps/web/src/modules/other/private.ts": "export type Shape = string\nexport class Kind {}\n",
            // clean: a re-export of one declaration, a private local of the same name, default exports
            "apps/web/src/modules/x/index.ts": "export { used } from './used'\n",
            "apps/web/src/modules/x/used.ts": "export const used = 1\n",
            "apps/web/src/modules/y/index.ts": "export { used } from '../x'\n",
            "apps/web/src/modules/z/local.ts": "const used = 2\nexport default used\n",
            "apps/web/src/modules/w/local.ts": "export default 3\n",
        },
    })
    s.tester.run("duplicate-symbol", rules["duplicate-symbol"], {
        valid: [
            s.good("apps/web/src/hooks/orders/useThing.ts"),
            s.good("apps/web/src/modules/x/used.ts"),
            s.good("apps/web/src/modules/y/index.ts"),
            s.good("apps/web/src/modules/z/local.ts"),
            s.good("apps/web/src/modules/w/local.ts"),
        ],
        invalid: [
            s.bad("apps/web/src/hooks/cart/useThing.ts", 1),
            s.bad("apps/web/src/modules/kinds/shape.ts", 1),
            s.bad("apps/web/src/modules/kinds/kind.ts", 1),
        ],
    })
})

// ---- alias-reexport (HFS_ALIAS_REEXPORT) ------------------------------------------------------------------------------------

test("HFS_ALIAS_REEXPORT: a re-export under another name, and a const, type or interface that only renames a repository declaration, are findings", (t) => {
    const s = scene(t, {
        files: {
            "apps/web/src/modules/config/index.ts": [
                "export { inner as renamed } from './inner'",
                "export { default as Thing } from './thing'",
                "export * as ns from './ns'",
                "export type { Shape as Contract } from './shape'",
                "export { plain, same as same } from './plain'",
                "import { local } from './local'",
                "export { local as other }",
                "",
            ].join("\n"),
            "apps/web/src/modules/config/inner.ts": "export const inner = 1\n",
            "apps/web/src/modules/config/thing.ts": "export default 1\n",
            "apps/web/src/modules/config/ns.ts": "export const one = 1\n",
            "apps/web/src/modules/config/shape.ts": "export type Shape = number\n",
            "apps/web/src/modules/config/plain.ts": "export const plain = 1\nexport const same = 2\n",
            "apps/web/src/modules/config/local.ts": "export const local = 1\n",
            "apps/web/src/modules/config/aliases.ts": [
                "import { Original, helper, Options, Shape, Config } from './original'",
                "import * as original from './original'",
                "export const Renamed = Original",
                "export const Moved = helper",
                "export const Bound = original.helper",
                "export type Optioned = Options",
                "export interface Shaped extends Shape {}",
                "export const ConfigAlias = Config",
                "",
            ].join("\n"),
            "apps/web/src/modules/config/original.ts": [
                "export class Original {}",
                "export function helper(): number { return 1 }",
                "export interface Options { flag: boolean }",
                "export type Shape = { width: number }",
                "export const Config = { url: 'u' }",
                "",
            ].join("\n"),
            // a const with a real initializer, a member that is data, a generic or bodied type and a package type are not aliases
            "apps/web/src/modules/config/fine.ts": [
                "import { Settings, limit } from './base'",
                "import type { Base } from './base'",
                "import type { Thing } from 'some-package'",
                "export const Limit = Settings.limit",
                "export interface Extended extends Base { name: string }",
                "export type Boxed<T> = Array<T>",
                "export type Wrapped = Base[]",
                "export type Packaged = Thing",
                "export const Copy = limit + 1",
                "",
            ].join("\n"),
            "apps/web/src/modules/config/base.ts": "export interface Base { id: string }\nexport const Settings = { limit: 3 }\nexport const limit = 4\n",
        },
    })
    s.tester.run("alias-reexport", rules["alias-reexport"], {
        valid: [
            s.good("apps/web/src/modules/config/fine.ts"),
            s.good("apps/web/src/modules/config/base.ts"),
            s.good("apps/web/src/modules/config/original.ts"),
            s.good("apps/web/src/modules/config/plain.ts"),
        ],
        invalid: [
            s.bad("apps/web/src/modules/config/index.ts", 1, 2, 3, 4, 7),
            s.bad("apps/web/src/modules/config/aliases.ts", 3, 4, 5, 6, 7, 8),
        ],
    })
})

test("HFS_ALIAS_REEXPORT: a route file binding a declaration to a name Next.js requires of a route segment is not a second name", (t) => {
    // The former false positive: `export const generateMetadata = homeMetadata` in page.tsx. Next.js fixes the name generateMetadata,
    // so no rename can remove it. The same binding outside a route file is still a second name.
    const metadata = "export const homeMetadata = async () => ({ title: 'home' })\nexport const HomePage = () => <main />\n"
    const s = scene(t, {
        files: {
            "apps/web/src/features/pages/HomePage/index.tsx": metadata,
            "apps/web/src/app/[locale]/page.tsx": "import { HomePage, homeMetadata } from '../../features/pages/HomePage'\nexport const generateMetadata = homeMetadata\nexport default function Page() { return <HomePage /> }\n",
            "apps/web/src/app/[locale]/about/page.tsx": "export { homeMetadata as generateMetadata } from '../../../features/pages/HomePage'\nexport default function Page() { return null }\n",
            "apps/web/src/modules/seo/index.ts": "import { homeMetadata } from '../../features/pages/HomePage'\nexport const generateMetadata = homeMetadata\n",
        },
    })
    s.tester.run("alias-reexport", rules["alias-reexport"], {
        valid: [s.good("apps/web/src/app/[locale]/page.tsx"), s.good("apps/web/src/app/[locale]/about/page.tsx")],
        invalid: [s.bad("apps/web/src/modules/seo/index.ts", 2)],
    })
})

// ---- cross-app-duplicate (FE_CROSS_APP_DUPLICATE) ---------------------------------------------------------------------------

const ERROR_PAGE = "'use client'\nexport default function GlobalError({ reset }: { reset: () => void }) {\n  return <button onClick={reset}>Retry</button>\n}\n"

test("FE_CROSS_APP_DUPLICATE: a file copied between apps is a finding on every copy; a thin adapter, a differing file and a copy inside one app are not", (t) => {
    const s = scene(t, {
        apps: TWO_APPS,
        files: {
            // equal token content, comments and whitespace dropped
            "apps/web/src/app/global-error.tsx": ERROR_PAGE,
            "apps/admin/src/app/global-error.tsx": `// admin copy\n${ERROR_PAGE.replace(/\n/gu, "\n\n")}`,
            // any size counts
            "apps/web/src/testing/axe.ts": "export const axeOptions = { rules: { region: { enabled: false } } }\n",
            "apps/admin/src/testing/axe.ts": "export const axeOptions = { rules: { region: { enabled: false } } }\n",
            // thin adapters that only re-export or import a package symbol are the sanctioned per-app route shape
            "apps/web/src/app/not-found.tsx": 'import NotFound from "@family/ui/not-found"\nexport default NotFound\n',
            "apps/admin/src/app/not-found.tsx": 'import NotFound from "@family/ui/not-found"\nexport default NotFound\n',
            "apps/web/src/app/error.tsx": 'export { default } from "@family/ui/error"\n',
            "apps/admin/src/app/error.tsx": 'export { default } from "@family/ui/error"\n',
            // an identifier or a literal that differs, and two copies inside one app
            "apps/web/src/testing/colors.ts": "export const colors = { region: { enabled: false } }\n",
            "apps/admin/src/testing/colors.ts": "export const colors = { region: { enabled: true } }\n",
            "apps/web/src/testing/one.ts": "export const counter = () => 1 + 1\n",
            "apps/web/src/testing/two.ts": "export const counter = () => 1 + 1\n",
        },
    })
    s.tester.run("cross-app-duplicate", rules["cross-app-duplicate"], {
        valid: [
            s.good("apps/web/src/app/not-found.tsx"),
            s.good("apps/admin/src/app/not-found.tsx"),
            s.good("apps/web/src/app/error.tsx"),
            s.good("apps/admin/src/app/error.tsx"),
            s.good("apps/web/src/testing/colors.ts"),
            s.good("apps/admin/src/testing/colors.ts"),
            s.good("apps/web/src/testing/one.ts"),
            s.good("apps/web/src/testing/two.ts"),
        ],
        invalid: [
            s.bad("apps/web/src/app/global-error.tsx", 1),
            s.bad("apps/admin/src/app/global-error.tsx", 1),
            s.bad("apps/web/src/testing/axe.ts", 1),
            s.bad("apps/admin/src/testing/axe.ts", 1),
        ],
    })
})

// ---- i18n-keys (FE_I18N_KEYS) -----------------------------------------------------------------------------------------------

const CATALOG_DIR = "apps/web/src/modules/i18n/messages"
const catalog = (extra = {}) => `${JSON.stringify({ home: { title: "Trang chu", subtitle: "Mo ta" }, common: { save: "Luu" }, ...extra })}\n`

test("FE_I18N_KEYS: a literal key read through next-intl is held by every locale; a translator that is not next-intl and a computed key are never judged", (t) => {
    const s = scene(t, {
        files: {
            [`${CATALOG_DIR}/vi.json`]: catalog({ orders: { card: { title: "The" }, status: { paid: "Paid", due: "Due" } } }),
            [`${CATALOG_DIR}/en.json`]: catalog({ orders: { card: { title: "The" }, status: { paid: "Paid", due: "Due" } } }),
            "apps/web/src/modules/i18n/use-copy.ts": [
                "import { useTranslations } from 'next-intl'",
                "import { getTranslations } from 'next-intl/server'",
                "export const useHome = () => {",
                "  const t = useTranslations('home')",
                "  return [t('title'), t.rich('subtitle')]",
                "}",
                "export const readCommon = async () => {",
                "  const t = await getTranslations({ namespace: 'common' })",
                "  return t('save')",
                "}",
                "",
            ].join("\n"),
            // a tail, a template and a table of keys reach the keys of a namespace
            "apps/web/src/modules/i18n/use-orders.ts": "import { useTranslations } from 'next-intl'\nconst KEYS = ['paid', 'due']\nexport const useOrders = (state: string) => {\n  const t = useTranslations('orders.status')\n  return [t(`${state}`), KEYS, useTranslations('orders.card')('title')]\n}\n",
            "apps/web/src/modules/i18n/other.ts": "import { useTranslations } from 'other-i18n'\nexport const a = () => {\n  const t = useTranslations('home')\n  return t('missing')\n}\n",
            "apps/web/src/modules/i18n/computed.ts": "import { useTranslations } from 'next-intl'\nexport const b = (ns: string, k: string) => {\n  const t = useTranslations(ns)\n  const u = useTranslations('home')\n  return [t('missing'), u(k)]\n}\n",
            // a namespaced read and a rich read of keys no locale holds
            "apps/web/src/modules/i18n/use-missing.ts": "import { useTranslations } from 'next-intl'\nexport const useMissing = () => {\n  const t = useTranslations('home')\n  return [t('nope'), t.rich('gone')]\n}\n",
        },
    })
    s.tester.run("i18n-keys", rules["i18n-keys"], {
        valid: [
            s.good("apps/web/src/modules/i18n/use-copy.ts"),
            s.good("apps/web/src/modules/i18n/use-orders.ts"),
            s.good("apps/web/src/modules/i18n/other.ts"),
            s.good("apps/web/src/modules/i18n/computed.ts"),
        ],
        invalid: [s.bad("apps/web/src/modules/i18n/use-missing.ts", 4, 4)],
    })
})

// ---- grammar-entry (ARCH_GRAMMAR_EXPORT_BYPASS, ARCH_GRAMMAR_CONTRACT_INVALID) ----------------------------------------------

const grammarPackage = (version) => ({
    "package.json": JSON.stringify({
        name: "@starci/grammar",
        version,
        peerDependencies: { react: ">=18", "@heroui/react": ">=2" },
        exports: { "./common": { types: "./dist/common/index.d.ts", import: "./dist/common/index.js" }, "./common.css": "./dist/common/styles.css", "./core.css": "./dist/core/styles.css" },
    }),
    "dist/common/index.js": "export const Button = () => null\n",
    "dist/common/index.d.ts": "export declare const Button: () => null\n",
    "dist/common/styles.css": ":root{}\n",
    "dist/core/styles.css": '@import "../common/styles.css";\n',
})

// The app root's one package.json declares the grammar and its peers for every app; the one install is at the app root.
const grammarFiles = () => {
    const files = {
        "../package.json": JSON.stringify({ name: "fixture", private: true, dependencies: { "@starci/grammar": "0.4.11", react: "19.0.0", "@heroui/react": "2.0.0" } }),
    }
    for (const [file, text] of Object.entries(grammarPackage("0.4.11"))) files[`../node_modules/@starci/grammar/${file}`] = text
    for (const app of ["app", "landing"]) {
        files[`apps/${app}/src/app/globals.css`] = '@import "@starci/grammar/common.css";\n'
        files[`apps/${app}/src/app/page.tsx`] = 'import { Button } from "@starci/grammar/common"\nexport default function Route() { return <Button /> }\n'
    }
    return files
}

test("ARCH_GRAMMAR_EXPORT_BYPASS: vendor grammar is reached only through its declared entry", (t) => {
    const s = scene(t, {
        apps: [{ name: "app", kind: "next" }, { name: "landing", kind: "next" }],
        files: {
            ...grammarFiles(),
            // a local export has no module specifier; a shadowed require is not the grammar import
            "apps/landing/src/app/local.ts": 'const label = "x"\nexport { label }\n',
            "apps/landing/src/app/shadow.ts": 'const require = (value: string) => value\nexport const local = require("@starci/grammar/private")\n',
            // a subpath the package does not declare, by import and by a real require
            "apps/app/src/app/core.tsx": 'import { Button } from "@starci/grammar/core"\nexport const Core = () => <Button />\n',
            "apps/app/src/app/direct.ts": 'export const direct = require("@starci/grammar/private")\n',
        },
    })
    s.tester.run("grammar-entry", rules["grammar-entry"], {
        valid: [
            s.good("apps/app/src/app/page.tsx"),
            s.good("apps/landing/src/app/page.tsx"),
            s.good("apps/landing/src/app/local.ts"),
            s.good("apps/landing/src/app/shadow.ts"),
        ],
        invalid: [
            s.bad("apps/app/src/app/core.tsx", 1),
            s.bad("apps/app/src/app/direct.ts", 1),
        ],
    })
})

// ---- package-imports-app, package-export-bypass (ARCH_PACKAGE_IMPORTS_APP, ARCH_PACKAGE_EXPORT_BYPASS) -----------------------

const packageTree = () => ({
    // the app root's one package.json: its workspaces are the fe side's packages
    "../package.json": JSON.stringify({ name: "fixture", private: true, workspaces: ["fe/packages/*"] }),
    "tsconfig.json": JSON.stringify({
        compilerOptions: {
            target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "preserve", allowJs: true, skipLibCheck: true, noEmit: true, baseUrl: ".",
            paths: { "@fixture/ui": ["packages/ui/src/index.ts"], "@fixture/ui/*": ["packages/ui/src/*"], "@fixture/web/*": ["apps/web/src/*"] },
        },
        include: ["apps/**/*", "packages/**/*"],
    }),
    "packages/ui/package.json": JSON.stringify({ name: "@fixture/ui", private: true, exports: { ".": "./src/index.ts", "./public": "./src/public/index.tsx" } }),
    "packages/ui/src/index.ts": 'export { Public } from "./public"\n',
    "packages/ui/src/private/index.tsx": "export const Private = () => <span />\n",
    "apps/web/src/app/page.tsx": 'import { Shown } from "../features/pages/Shown"\nexport default function Route() { return <Shown /> }\n',
    "apps/web/src/features/pages/Shown/index.tsx": 'import { Public } from "@fixture/ui/public"\nexport const Shown = () => <Public />\n',
    "apps/web/src/features/pages/Peeking/index.tsx": 'import { Public } from "@fixture/ui/public"\nimport { Private } from "@fixture/ui/private"\nexport const Peeking = () => <><Public /><Private /></>\n',
    "apps/web/src/contracts/app.ts": "export type AppContract = string\n",
})

test("ARCH_PACKAGE_EXPORT_BYPASS: a package is imported only through its declared exports", (t) => {
    const s = scene(t, {
        files: {
            ...packageTree(),
            "packages/ui/src/public/index.tsx": "export const Public = () => <span />\n",
        },
    })
    s.tester.run("package-export-bypass", rules["package-export-bypass"], {
        valid: [
            // the declared export, by its package name
            s.good("apps/web/src/features/pages/Shown/index.tsx"),
            s.good("packages/ui/src/index.ts"),
            s.good("packages/ui/src/public/index.tsx"),
        ],
        // the undeclared subpath of a package
        invalid: [s.bad("apps/web/src/features/pages/Peeking/index.tsx", 2)],
    })
})

test("ARCH_PACKAGE_IMPORTS_APP: a package never imports an app", (t) => {
    const s = scene(t, {
        files: {
            ...packageTree(),
            "packages/ui/src/public/index.tsx": 'export type { AppContract } from "@fixture/web/contracts/app"\nexport const Public = () => <span />\n',
            "packages/ui/src/private/clean.tsx": "export const Clean = () => <span />\n",
        },
    })
    s.tester.run("package-imports-app", rules["package-imports-app"], {
        valid: [
            // an app importing a package is the allowed direction
            s.good("apps/web/src/features/pages/Shown/index.tsx"),
            s.good("packages/ui/src/index.ts"),
            s.good("packages/ui/src/private/clean.tsx"),
        ],
        invalid: [s.bad("packages/ui/src/public/index.tsx", 1)],
    })
})
