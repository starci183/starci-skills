/**
 * Twin tests for the Next conventions rules (`FE_NEXT_CONVENTIONS`).
 *
 *   node --test next-conventions.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, FE_DECLARATION, slotTester } from "./fixtures/typed/tester.mjs"
import {
  htmlLangFromLocale,
  i18nStackInOneModule,
  localeSegmentIsLocale,
  navigationFromIntl,
  noHardcodedRoute,
  noMiddlewareFile,
  noNativeAnchor,
  noNullSuspenseFallback,
  noSecondI18nStack,
  pageExportsMetadata,
  rules,
} from "./next-conventions.mjs"

const tester = slotTester()

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("FE-NEXT-1: the interceptor is proxy.ts and exports proxy", () => {
  tester.run("no-middleware-file", noMiddlewareFile, {
    valid: [
      { filename: at("apps/web/src/proxy.ts"), code: "export function proxy(request) { return request }" },
      { filename: at("apps/web/src/proxy.ts"), code: "export const proxy = (request) => request\nexport const config = { matcher: [] }" },
      { filename: at("apps/web/src/proxy.ts"), code: "export default function proxy() {}" },
      // a helper that merely has the word in its name deep in the tree is not the interceptor
      { filename: at("apps/web/src/modules/http/middleware.ts"), code: "export const x = 1" },
      // a middleware-named file beside a route or in a component folder is not the source-root interceptor
      { filename: at("apps/web/src/app/[locale]/middleware.ts"), code: "export const x = 1" },
      { filename: at("apps/web/src/components/blocks/Nav/middleware.ts"), code: "export const x = 1" },
      // a proxy.ts in a folder the slot does not pin is no interceptor: its export names are nobody's business here
      { filename: at("apps/web/src/modules/http/proxy.ts"), code: "export const middleware = 1" },
    ],
    invalid: [
      { filename: at("apps/web/src/middleware.ts"), code: "export function middleware() {}", errors: [{ messageId: "file" }] },
      { filename: at("apps/web/src/middleware.ts"), code: "export const x = 1", errors: [{ messageId: "file" }] },
      { filename: at("apps/web/src/proxy.ts"), code: "export function middleware() {}", errors: [{ messageId: "export" }] },
      { filename: at("apps/web/src/proxy.ts"), code: "const middleware = () => 1\nexport { middleware }", errors: [{ messageId: "export" }] },
      { filename: at("apps/web/src/proxy.ts"), code: "export const middleware = () => 1", errors: [{ messageId: "export" }] },
    ],
  })
})

test("FE-NEXT-2: the locale segment is [locale]", () => {
  tester.run("locale-segment-is-locale", localeSegmentIsLocale, {
    valid: [
      { filename: at("apps/web/src/app/[locale]/page.tsx"), code: "export default function P() {}" },
      { filename: at("apps/web/src/app/[locale]/courses/[slug]/page.tsx"), code: "export default function P() {}" },
      { filename: at("apps/web/src/app/api/route.ts"), code: "export const GET = 1" },
      // a folder named [lang] that the route slot does not own is not a locale segment
      { filename: at("apps/web/src/components/app/[lang]/page.tsx"), code: "export default function P() {}" },
    ],
    invalid: [
      { filename: at("apps/web/src/app/[lang]/page.tsx"), code: "export default function P() {}", errors: [{ messageId: "segment" }] },
      { filename: at("apps/web/src/app/[lng]/x/page.tsx"), code: "export default function P() {}", errors: [{ messageId: "segment" }] },
      { filename: at("apps/web/src/app/[lang]/layout.tsx"), code: "export default function L() {}", errors: [{ messageId: "segment" }] },
      { filename: at("apps/admin/src/app/[locale]/[i18n]/x/page.tsx"), code: "export const metadata = 1", errors: [{ messageId: "segment" }] },
    ],
  })
})

test("FE-NEXT-3: next-intl is the only i18n stack", () => {
  tester.run("no-second-i18n-stack", noSecondI18nStack, {
    valid: [
      { code: "import { useTranslations } from \"next-intl\"" },
      { code: "import { getTranslations } from \"next-intl/server\"" },
      { code: "import { useState } from \"react\"" },
    ],
    invalid: [
      { code: "import { useTranslation } from \"react-i18next\"", errors: [{ messageId: "stack" }] },
      { code: "import i18n from \"i18next\"", errors: [{ messageId: "stack" }] },
      { code: "import { useIntl } from \"react-intl\"", errors: [{ messageId: "stack" }] },
      { code: "import { t } from \"@lingui/core\"", errors: [{ messageId: "stack" }] },
    ],
  })
})

test("FE-NEXT-4: html lang comes from the locale", () => {
  tester.run("html-lang-from-locale", htmlLangFromLocale, {
    valid: [
      { code: "const L = ({ locale }) => <html lang={locale}><body /></html>" },
      { code: "const L = () => <html><body /></html>" },
      // a lang attribute on another element is a content-language marker, not the document's
      { code: "const L = () => <span lang=\"en\">hello</span>" },
    ],
    invalid: [
      { code: "const L = () => <html lang=\"en\"><body /></html>", errors: [{ messageId: "lang" }] },
      { code: "const L = () => <html lang={\"vi\"}><body /></html>", errors: [{ messageId: "lang" }] },
      { code: "const L = () => <html lang={`vi`}><body /></html>", errors: [{ messageId: "lang" }] },
    ],
  })
})

test("FE-NEXT-5: every page exports metadata", () => {
  tester.run("page-exports-metadata", pageExportsMetadata, {
    valid: [
      { filename: at("apps/web/src/app/[locale]/page.tsx"), code: "export const metadata = { title: 'Home' }\nexport default function P() {}" },
      { filename: at("apps/web/src/app/[locale]/courses/page.tsx"), code: "export async function generateMetadata() { return {} }\nexport default function P() {}" },
      { filename: at("apps/web/src/app/[locale]/courses/page.tsx"), code: "export const generateMetadata = async () => ({})\nexport default function P() {}" },
      { filename: at("apps/web/src/app/[locale]/courses/page.tsx"), code: "export { metadata } from '@/features/pages/Courses'\nexport default function P() {}" },
      // only pages name themselves; a layout inherits and a component is not a route
      { filename: at("apps/web/src/app/[locale]/layout.tsx"), code: "export default function L() {}" },
      { filename: at("apps/web/src/features/pages/Home/index.tsx"), code: "export const Home = () => null" },
      { filename: at("apps/web/src/app/[locale]/page.test.tsx"), code: "export default function P() {}" },
      // a page.tsx that no route slot owns is not a page
      { filename: at("apps/web/src/components/blocks/Nav/page.tsx"), code: "export default function P() {}" },
      { filename: at("apps/web/src/features/pages/Home/page.tsx"), code: "export default function P() {}" },
    ],
    invalid: [
      { filename: at("apps/web/src/app/[locale]/page.tsx"), code: "export default function P() {}", errors: [{ messageId: "metadata" }] },
      {
        filename: at("apps/web/src/app/[locale]/(app)/profile/page.tsx"),
        code: "export const revalidate = 60\nexport default function P() {}",
        errors: [{ messageId: "metadata" }],
      },
    ],
  })
})

test("FE-NEXT-6: a Suspense boundary has a fallback that renders something", () => {
  tester.run("no-null-suspense-fallback", noNullSuspenseFallback, {
    valid: [
      { code: "const A = () => <Suspense fallback={<Skeleton />}><B /></Suspense>" },
      { code: "const A = () => <React.Suspense fallback={<Skeleton />}><B /></React.Suspense>" },
      { code: "const A = () => <Boundary fallback={null}><B /></Boundary>" },
    ],
    invalid: [
      { code: "const A = () => <Suspense fallback={null}><B /></Suspense>", errors: [{ messageId: "nullFallback" }] },
      { code: "const A = () => <Suspense><B /></Suspense>", errors: [{ messageId: "nullFallback" }] },
      { code: "const A = () => <Suspense fallback={undefined}><B /></Suspense>", errors: [{ messageId: "nullFallback" }] },
      { code: "const A = () => <React.Suspense fallback={null}><B /></React.Suspense>", errors: [{ messageId: "nullFallback" }] },
    ],
  })
})

test("FE-NEXT-7: navigation helpers come from modules/i18n/navigation", () => {
  tester.run("navigation-from-intl", navigationFromIntl, {
    valid: [
      { filename: at("apps/web/src/components/blocks/Nav/index.tsx"), code: "import { Link, useRouter, usePathname } from '@/modules/i18n/navigation'" },
      { filename: at("apps/web/src/components/blocks/Nav/index.tsx"), code: "import { notFound, useSearchParams, useParams } from 'next/navigation'" },
      { filename: at("apps/web/src/components/blocks/Nav/index.tsx"), code: "import type { Route } from 'next/navigation'" },
      // the boundary outside the locale provider and the navigation module itself
      { filename: at("apps/web/src/app/global-error.tsx"), code: "import { usePathname } from 'next/navigation'" },
      { filename: at("apps/web/src/modules/i18n/navigation.ts"), code: "import { redirect } from 'next/navigation'" },
      { filename: at("apps/web/src/components/blocks/Nav/index.test.tsx"), code: "import Link from 'next/link'" },
      { filename: at("apps/web/src/proxy.ts"), code: "import { redirect } from 'next/navigation'" },
    ],
    invalid: [
      { filename: at("apps/web/src/components/blocks/Nav/index.tsx"), code: "import Link from 'next/link'", errors: [{ messageId: "link" }] },
      { filename: at("apps/web/src/components/blocks/Nav/index.tsx"), code: "import { useRouter } from 'next/navigation'", errors: [{ messageId: "helper" }] },
      { filename: at("apps/web/src/app/[locale]/page.tsx"), code: "import { redirect } from 'next/navigation'", errors: [{ messageId: "helper" }] },
      // only the proxy and global-error are exempt from the source-root slot and the route slot, not their siblings
      { filename: at("apps/web/src/instrumentation.ts"), code: "import { redirect } from 'next/navigation'", errors: [{ messageId: "helper" }] },
      { filename: at("apps/web/src/instrumentation-client.ts"), code: "import { useRouter } from 'next/navigation'", errors: [{ messageId: "helper" }] },
      { filename: at("apps/web/src/app/[locale]/error.tsx"), code: "import { useRouter } from 'next/navigation'", errors: [{ messageId: "helper" }] },
      {
        filename: at("apps/web/src/components/blocks/Nav/index.tsx"),
        code: "import { usePathname, notFound, permanentRedirect } from 'next/navigation'",
        errors: [{ messageId: "helper" }, { messageId: "helper" }],
      },
    ],
  })
})

test("FE-NEXT-8: no hand-drawn anchor for an internal route", () => {
  tester.run("no-native-anchor", noNativeAnchor, {
    valid: [
      { code: 'const A = () => <a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>' },
      { code: 'const A = () => <a href="mailto:help@example.com">x</a>' },
      { code: 'const A = () => <a href="tel:+84900000000">x</a>' },
      { code: 'const A = () => <a href="#main">skip</a>' },
      { code: "const A = () => <a href={url}>x</a>" },
      { code: 'const A = () => <Link href="/courses">x</Link>' },
      { filename: at("apps/web/src/components/blocks/Nav/index.test.tsx"), code: 'const A = () => <a href="/x">x</a>' },
    ],
    invalid: [
      { code: 'const A = () => <a href="/courses">x</a>', errors: [{ messageId: "internal" }] },
      { code: "const A = () => <a href={`/courses`}>x</a>", errors: [{ messageId: "internal" }] },
      { code: 'const A = () => <a href="https://example.com" target="_blank">x</a>', errors: [{ messageId: "rel" }] },
      { code: 'const A = () => <a href="/x" target="_blank">x</a>', errors: [{ messageId: "internal" }, { messageId: "rel" }] },
    ],
  })
})

test("FE-NEXT-9: a route is built by modules/routes, not written at the call", () => {
  const NAV = at("apps/web/src/components/blocks/Nav/index.tsx")
  tester.run("no-hardcoded-route", noHardcodedRoute, {
    valid: [
      { filename: NAV, code: "const A = () => <Link href={routes.course(slug)}>x</Link>" },
      { filename: NAV, code: "router.push(routes.home())" },
      { filename: NAV, code: 'const A = () => <Link href="https://example.com">x</Link>' },
      { filename: NAV, code: 'const A = () => <Link href="/">home</Link>' },
      { filename: NAV, code: 'const A = () => <a href="mailto:hi@example.com">x</a>' },
      { filename: NAV, code: 'const a = value.replace("/x", "")' },
      { filename: NAV, code: 'stack.push("/x")' },
      { filename: at("apps/web/src/modules/routes/index.ts"), code: "export const course = (slug) => `/courses/${slug}`" },
      { filename: at("apps/web/src/modules/routes/index.tsx"), code: 'const A = () => <Link href="/courses">x</Link>' },
      { filename: at("apps/admin/src/modules/i18n/navigation.ts"), code: 'redirect("/courses")' },
      { filename: at("apps/web/src/components/blocks/Nav/index.test.tsx"), code: 'router.push("/courses")' },
    ],
    invalid: [
      { filename: NAV, code: 'const A = () => <Link href="/courses">x</Link>', errors: [{ messageId: "route" }] },
      { filename: NAV, code: "const A = () => <Link href={`/courses/${slug}`}>x</Link>", errors: [{ messageId: "route" }] },
      { filename: NAV, code: 'const A = () => <a href="/tasks">x</a>', errors: [{ messageId: "route" }] },
      { filename: NAV, code: 'router.push("/agentos/workspaces/new")', errors: [{ messageId: "route" }] },
      { filename: NAV, code: "router.replace(`/orders/${id}`)", errors: [{ messageId: "route" }] },
      { filename: at("apps/web/src/features/pages/Home/index.tsx"), code: 'redirect("/sign-in")', errors: [{ messageId: "route" }] },
      // a folder named routes that the routes slot does not own gets no exemption
      { filename: at("apps/web/src/components/blocks/routes/index.tsx"), code: 'redirect("/sign-in")', errors: [{ messageId: "route" }] },
    ],
  })
})

test("FE-NEXT-10: the next-intl stack is written once per repository", () => {
  const multi = slotTester()
  const single = slotTester({ declaration: { ...FE_DECLARATION, apps: [{ name: "web", kind: "next" }] } })
  const ROUTING = 'import { defineRouting } from "next-intl/routing"\nexport const routing = defineRouting({ locales: ["vi"], defaultLocale: "vi", localePrefix: "as-needed" })'
  const NAVIGATION = 'import { createNavigation } from "next-intl/navigation"\nexport const { Link } = createNavigation(routing)'
  const REQUEST = 'import { getRequestConfig } from "next-intl/server"\nexport default getRequestConfig(async () => ({ locale: "vi", messages: {} }))'
  const MIDDLEWARE = 'import createMiddleware from "next-intl/middleware"\nexport const proxy = createMiddleware(routing)'
  const PACKAGE = at("packages/nivo-i18n/src/app.ts")
  const APP_INDEX = at("apps/web/src/modules/i18n/index.ts")
  const APP_REQUEST = at("apps/web/src/modules/i18n/request.ts")
  multi.run("i18n-stack-in-one-module", i18nStackInOneModule, {
    valid: [
      // the package factory is where the stack is written, all four layers
      { filename: PACKAGE, code: ROUTING },
      { filename: PACKAGE, code: NAVIGATION },
      { filename: PACKAGE, code: REQUEST },
      { filename: PACKAGE, code: MIDDLEWARE },
      { filename: at("packages/nivo-i18n/src/request.ts"), code: REQUEST },
      // an app calls the package factory, not next-intl's
      { filename: APP_INDEX, code: 'import { createAppI18n } from "@nivo/i18n"\nexport const i18n = createAppI18n({ locales: ["vi"] })' },
      { filename: APP_REQUEST, code: 'import { i18n } from "./index"\nexport default i18n.requestConfig' },
      // using the stack's products is not building one
      { filename: at("apps/web/src/features/pages/home/component.tsx"), code: 'import { useTranslations } from "next-intl"\nimport { getTranslations } from "next-intl/server"\nconst t = await getTranslations("home")' },
      // a function that only has the name, not bound to next-intl
      { filename: APP_REQUEST, code: 'import { getRequestConfig } from "./config"\nexport default getRequestConfig(async () => ({}))' },
      { filename: APP_REQUEST, code: "const getRequestConfig = (f) => f\nexport default getRequestConfig(() => 1)" },
      { filename: APP_REQUEST, code: "export const x = api.createNavigation(routing)" },
      // the same name from the same module, but not called
      { filename: APP_INDEX, code: 'import type { defineRouting } from "next-intl/routing"\nexport type Define = typeof defineRouting' },
      // a spec builds a stack to prove a module
      { filename: at("apps/web/src/modules/i18n/request.spec.ts"), code: NAVIGATION },
    ],
    invalid: [
      // a multi-app repository: no app builds a layer, whichever layer and however it is imported
      { filename: APP_REQUEST, code: REQUEST, errors: [{ messageId: "stack" }] },
      { filename: at("apps/admin/src/modules/i18n/request.ts"), code: REQUEST, errors: [{ messageId: "stack" }] },
      { filename: at("apps/web/src/modules/i18n/routing.ts"), code: ROUTING, errors: [{ messageId: "stack" }] },
      { filename: at("apps/web/src/modules/i18n/navigation.ts"), code: NAVIGATION, errors: [{ messageId: "stack" }] },
      { filename: at("apps/web/src/proxy.ts"), code: MIDDLEWARE, errors: [{ messageId: "stack" }] },
      { filename: APP_REQUEST, code: 'import { getRequestConfig as request } from "next-intl/server"\nexport default request(async () => ({}))', errors: [{ messageId: "stack" }] },
      { filename: APP_REQUEST, code: 'import * as server from "next-intl/server"\nexport default server.getRequestConfig(async () => ({}))', errors: [{ messageId: "stack" }] },
      { filename: APP_REQUEST, code: 'import mw from "next-intl/middleware"\nexport const proxy = mw(routing)', errors: [{ messageId: "stack" }] },
      // outside `modules/i18n` altogether, and in a package that is not the i18n package
      { filename: at("apps/web/src/hooks/lesson/useLesson.ts"), code: NAVIGATION, errors: [{ messageId: "stack" }] },
      { filename: at("packages/nivo-ui/src/leaves/Menu/component.tsx"), code: NAVIGATION, errors: [{ messageId: "stack" }] },
      { filename: at("packages/nivo-api/src/client.ts"), code: REQUEST, errors: [{ messageId: "stack" }] },
    ],
  })
  single.run("i18n-stack-in-one-module", i18nStackInOneModule, {
    valid: [
      // a repository with exactly one app writes the stack in that app's modules/i18n
      { filename: APP_REQUEST, code: REQUEST },
      { filename: at("apps/web/src/modules/i18n/routing.ts"), code: ROUTING },
      { filename: at("apps/web/src/modules/i18n/navigation.ts"), code: NAVIGATION },
      { filename: PACKAGE, code: REQUEST },
      // the proxy mounts the locale middleware built from the one routing (starci-next-fe apps/web/src/proxy.ts)
      { filename: at("apps/web/src/proxy.ts"), code: MIDDLEWARE },
    ],
    invalid: [
      // still one place: not a hook or a feature; and the proxy builds only the middleware, never the routing
      { filename: at("apps/web/src/hooks/lesson/useLesson.ts"), code: NAVIGATION, errors: [{ messageId: "stack" }] },
      { filename: at("apps/web/src/features/pages/home/component.tsx"), code: REQUEST, errors: [{ messageId: "stack" }] },
      { filename: at("apps/web/src/proxy.ts"), code: ROUTING, errors: [{ messageId: "stack" }] },
    ],
  })
})
