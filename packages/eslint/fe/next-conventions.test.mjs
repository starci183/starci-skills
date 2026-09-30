/**
 * Twin tests for the Next conventions rules (`FE_NEXT_CONVENTIONS`).
 *
 *   node --test next-conventions.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  htmlLangFromLocale,
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

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("FE-NEXT-1: the interceptor is proxy.ts and exports proxy", () => {
  tester.run("no-middleware-file", noMiddlewareFile, {
    valid: [
      { filename: "D:/repo/src/proxy.ts", code: "export function proxy(request) { return request }" },
      { filename: "D:/repo/src/proxy.ts", code: "export const proxy = (request) => request\nexport const config = { matcher: [] }" },
      { filename: "D:/repo/apps/web/src/proxy.ts", code: "export default function proxy() {}" },
      // a helper that merely has the word in its name deep in the tree is not the interceptor
      { filename: "D:/repo/src/modules/http/middleware.ts", code: "export const x = 1" },
    ],
    invalid: [
      { filename: "D:/repo/src/middleware.ts", code: "export function middleware() {}", errors: [{ messageId: "file" }] },
      { filename: "D:/repo/apps/web/src/middleware.ts", code: "export const x = 1", errors: [{ messageId: "file" }] },
      { filename: "D:/repo/src/proxy.ts", code: "export function middleware() {}", errors: [{ messageId: "export" }] },
      { filename: "D:/repo/src/proxy.ts", code: "const middleware = () => 1\nexport { middleware }", errors: [{ messageId: "export" }] },
      { filename: "D:/repo/src/proxy.ts", code: "export const middleware = () => 1", errors: [{ messageId: "export" }] },
    ],
  })
})

test("FE-NEXT-2: the locale segment is [locale]", () => {
  tester.run("locale-segment-is-locale", localeSegmentIsLocale, {
    valid: [
      { filename: "D:/repo/src/app/[locale]/page.tsx", code: "export default function P() {}" },
      { filename: "D:/repo/src/app/[locale]/courses/[slug]/page.tsx", code: "export default function P() {}" },
      { filename: "D:/repo/src/app/api/route.ts", code: "export const GET = 1" },
    ],
    invalid: [
      { filename: "D:/repo/src/app/[lang]/page.tsx", code: "export default function P() {}", errors: [{ messageId: "segment" }] },
      { filename: "D:/repo/src/app/[lng]/x/page.tsx", code: "export default function P() {}", errors: [{ messageId: "segment" }] },
      { filename: "D:/repo/apps/web/src/app/[lang]/layout.tsx", code: "export default function L() {}", errors: [{ messageId: "segment" }] },
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
      { filename: "D:/repo/src/app/[locale]/page.tsx", code: "export const metadata = { title: 'Home' }\nexport default function P() {}" },
      { filename: "D:/repo/src/app/[locale]/courses/page.tsx", code: "export async function generateMetadata() { return {} }\nexport default function P() {}" },
      { filename: "D:/repo/src/app/[locale]/courses/page.tsx", code: "export const generateMetadata = async () => ({})\nexport default function P() {}" },
      { filename: "D:/repo/src/app/[locale]/courses/page.tsx", code: "export { metadata } from '@/features/pages/Courses'\nexport default function P() {}" },
      // only pages name themselves; a layout inherits and a component is not a route
      { filename: "D:/repo/src/app/[locale]/layout.tsx", code: "export default function L() {}" },
      { filename: "D:/repo/src/features/pages/Home/index.tsx", code: "export const Home = () => null" },
      { filename: "D:/repo/src/app/[locale]/page.test.tsx", code: "export default function P() {}" },
    ],
    invalid: [
      { filename: "D:/repo/src/app/[locale]/page.tsx", code: "export default function P() {}", errors: [{ messageId: "metadata" }] },
      {
        filename: "D:/repo/apps/web/src/app/[locale]/(app)/profile/page.tsx",
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
      { filename: "D:/repo/src/components/blocks/Nav/index.tsx", code: "import { Link, useRouter, usePathname } from '@/modules/i18n/navigation'" },
      { filename: "D:/repo/src/components/blocks/Nav/index.tsx", code: "import { notFound, useSearchParams, useParams } from 'next/navigation'" },
      { filename: "D:/repo/src/components/blocks/Nav/index.tsx", code: "import type { Route } from 'next/navigation'" },
      // the boundary outside the locale provider and the navigation module itself
      { filename: "D:/repo/src/app/global-error.tsx", code: "import { usePathname } from 'next/navigation'" },
      { filename: "D:/repo/src/modules/i18n/navigation.ts", code: "import { redirect } from 'next/navigation'" },
      { filename: "D:/repo/src/components/blocks/Nav/index.test.tsx", code: "import Link from 'next/link'" },
    ],
    invalid: [
      { filename: "D:/repo/src/components/blocks/Nav/index.tsx", code: "import Link from 'next/link'", errors: [{ messageId: "link" }] },
      { filename: "D:/repo/src/components/blocks/Nav/index.tsx", code: "import { useRouter } from 'next/navigation'", errors: [{ messageId: "helper" }] },
      { filename: "D:/repo/src/app/[locale]/page.tsx", code: "import { redirect } from 'next/navigation'", errors: [{ messageId: "helper" }] },
      {
        filename: "D:/repo/src/components/blocks/Nav/index.tsx",
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
      { filename: "D:/repo/src/components/blocks/Nav/index.test.tsx", code: 'const A = () => <a href="/x">x</a>' },
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
  const NAV = "D:/repo/src/components/blocks/Nav/index.tsx"
  tester.run("no-hardcoded-route", noHardcodedRoute, {
    valid: [
      { filename: NAV, code: "const A = () => <Link href={routes.course(slug)}>x</Link>" },
      { filename: NAV, code: "router.push(routes.home())" },
      { filename: NAV, code: 'const A = () => <Link href="https://example.com">x</Link>' },
      { filename: NAV, code: 'const A = () => <Link href="/">home</Link>' },
      { filename: NAV, code: 'const A = () => <a href="mailto:hi@example.com">x</a>' },
      { filename: NAV, code: 'const a = value.replace("/x", "")' },
      { filename: NAV, code: 'stack.push("/x")' },
      { filename: "D:/repo/src/modules/routes/index.ts", code: "export const course = (slug) => `/courses/${slug}`" },
      { filename: "D:/repo/src/modules/routes/index.tsx", code: 'const A = () => <Link href="/courses">x</Link>' },
      { filename: "D:/repo/src/components/blocks/Nav/index.test.tsx", code: 'router.push("/courses")' },
    ],
    invalid: [
      { filename: NAV, code: 'const A = () => <Link href="/courses">x</Link>', errors: [{ messageId: "route" }] },
      { filename: NAV, code: "const A = () => <Link href={`/courses/${slug}`}>x</Link>", errors: [{ messageId: "route" }] },
      { filename: NAV, code: 'const A = () => <a href="/tasks">x</a>', errors: [{ messageId: "route" }] },
      { filename: NAV, code: 'router.push("/agentos/workspaces/new")', errors: [{ messageId: "route" }] },
      { filename: NAV, code: "router.replace(`/orders/${id}`)", errors: [{ messageId: "route" }] },
      { filename: "D:/repo/src/features/pages/Home/index.tsx", code: 'redirect("/sign-in")', errors: [{ messageId: "route" }] },
    ],
  })
})
