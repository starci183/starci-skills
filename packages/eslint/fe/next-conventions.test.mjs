/**
 * Twin tests for the Next conventions rules (`FE_NEXT_CONVENTIONS`).
 *
 *   node --test next-conventions.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { htmlLangFromLocale, localeSegmentIsLocale, noMiddlewareFile, noSecondI18nStack, rules } from "./next-conventions.mjs"

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
