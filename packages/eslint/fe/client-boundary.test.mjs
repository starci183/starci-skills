/**
 * Twin tests for the client-boundary rule (HFS R55).
 *
 *   node --test client-boundary.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  clientNoServerImport,
  noDangerousHtml,
  rules,
  useClientOnlyAtBoundary,
  webStorageOnlyInModules,
} from "./client-boundary.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const DIRECTIVE = "\"use client\"\nexport const X = () => null"
const PLAIN = "export const X = () => null"

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("FE-CLIENT-1: the directive sits only at an interaction boundary", () => {
  tester.run("use-client-only-at-boundary", useClientOnlyAtBoundary, {
    valid: [
      { filename: "D:/repo/src/components/blocks/Feed/index.tsx", code: DIRECTIVE },
      { filename: "D:/repo/src/components/leaves/Menu/index.tsx", code: DIRECTIVE },
      { filename: "D:/repo/src/features/overlays/Compose/index.tsx", code: DIRECTIVE },
      // a workspace package keeps its grammar tiers at src/<tier>, with no components/ folder
      { filename: "D:/repo/packages/nivo-ui/src/leaves/NivoIcon/index.tsx", code: DIRECTIVE },
      { filename: "D:/repo/packages/nivo-ui/src/leaves/NivoGrammar/index.ts", code: DIRECTIVE },
      { filename: "D:/repo/packages/nivo-ui/src/branches/Rail/component.tsx", code: DIRECTIVE },
      { filename: "D:/repo/packages/ui/src/branches/Rail/index.tsx", code: DIRECTIVE },
      { filename: "D:/repo/src/app/error.tsx", code: DIRECTIVE },
      { filename: "D:/repo/src/app/global-error.tsx", code: DIRECTIVE },
      { filename: "D:/repo/src/app/[locale]/error.tsx", code: DIRECTIVE },
      // no directive, no finding, wherever the file sits
      { filename: "D:/repo/src/app/[locale]/layout.tsx", code: PLAIN },
      { filename: "D:/repo/src/app/[locale]/page.tsx", code: PLAIN },
      { filename: "D:/repo/src/features/pages/Home/index.tsx", code: PLAIN },
      // a spec is not product source
      { filename: "D:/repo/src/app/[locale]/page.test.tsx", code: DIRECTIVE },
      // a string that merely reads like the directive is not one
      { filename: "D:/repo/src/app/[locale]/page.tsx", code: "const s = \"use client\"" },
    ],
    invalid: [
      { filename: "D:/repo/src/app/[locale]/layout.tsx", code: DIRECTIVE, errors: [{ messageId: "slot" }] },
      { filename: "D:/repo/src/app/[locale]/page.tsx", code: DIRECTIVE, errors: [{ messageId: "slot" }] },
      { filename: "D:/repo/src/app/[locale]/loading.tsx", code: DIRECTIVE, errors: [{ messageId: "slot" }] },
      { filename: "D:/repo/src/app/[locale]/not-found.tsx", code: DIRECTIVE, errors: [{ messageId: "slot" }] },
      { filename: "D:/repo/src/features/layouts/Shell/index.tsx", code: DIRECTIVE, errors: [{ messageId: "slot" }] },
      { filename: "D:/repo/src/features/pages/Home/index.tsx", code: DIRECTIVE, errors: [{ messageId: "slot" }] },
      { filename: "D:/repo/src/components/composites/Row/index.tsx", code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      // the package layout does not widen the app layout, and a package composite is not a boundary
      { filename: "D:/repo/packages/nivo-ui/src/composites/Row/index.tsx", code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      { filename: "D:/repo/apps/app/src/leaves/Menu/index.tsx", code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      { filename: "D:/repo/apps/app/src/components/branches/Rail/index.tsx", code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      { filename: "D:/repo/src/components/blocks/Feed/component.tsx", code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      { filename: "D:/repo/src/hooks/session/useSession.ts", code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      { filename: "D:/repo/src/modules/api/client.ts", code: "'use client'\nexport const x = 1", errors: [{ messageId: "elsewhere" }] },
    ],
  })
})

test("FE-CLIENT-2: a client component imports nothing that exists only on the server", () => {
  const CLIENT = "D:/repo/src/components/blocks/Feed/index.tsx"
  tester.run("client-no-server-import", clientNoServerImport, {
    valid: [
      { filename: CLIENT, code: '"use client"\nimport { useState } from "react"' },
      { filename: CLIENT, code: '"use client"\nimport useSWR from "swr"\nimport { readCourses } from "@/hooks/courses/useCourses"' },
      { filename: CLIENT, code: '"use client"\nimport type { Headers } from "next/headers"' },
      // a server component may import all of it
      { filename: "D:/repo/src/features/pages/Home/index.tsx", code: 'import { headers } from "next/headers"\nimport { readCourses } from "@/modules/api/courses/read-courses"' },
      { filename: "D:/repo/src/features/pages/Home/index.tsx", code: 'import "server-only"' },
      { filename: "D:/repo/src/components/blocks/Feed/index.test.tsx", code: '"use client"\nimport fs from "node:fs"' },
    ],
    invalid: [
      { filename: CLIENT, code: '"use client"\nimport "server-only"', errors: [{ messageId: "server" }] },
      { filename: CLIENT, code: '"use client"\nimport { cookies } from "next/headers"', errors: [{ messageId: "server" }] },
      { filename: CLIENT, code: '"use client"\nimport fs from "node:fs"', errors: [{ messageId: "server" }] },
      { filename: CLIENT, code: '"use client"\nimport { join } from "path"', errors: [{ messageId: "server" }] },
      {
        filename: CLIENT,
        code: '"use client"\nimport { readCourses } from "@/modules/api/courses/read-courses"',
        errors: [{ messageId: "server" }],
      },
    ],
  })
})

test("FE-CLIENT-3: web storage is touched only inside modules", () => {
  tester.run("web-storage-only-in-modules", webStorageOnlyInModules, {
    valid: [
      { filename: "D:/repo/src/modules/theme/index.ts", code: 'window.localStorage.setItem("theme", value)' },
      { filename: "D:/repo/src/modules/session/storage.ts", code: 'const v = sessionStorage.getItem("k")' },
      { filename: "D:/repo/src/components/blocks/Feed/index.tsx", code: "const store = { localStorage: 1 }" },
      { filename: "D:/repo/src/components/blocks/Feed/index.tsx", code: "const v = repo.localStorage" },
      { filename: "D:/repo/src/components/blocks/Feed/index.test.tsx", code: 'localStorage.clear()' },
    ],
    invalid: [
      { filename: "D:/repo/src/components/blocks/Feed/index.tsx", code: 'const v = localStorage.getItem("k")', errors: [{ messageId: "storage" }] },
      { filename: "D:/repo/src/components/blocks/Feed/index.tsx", code: 'sessionStorage.setItem("k", "v")', errors: [{ messageId: "storage" }] },
      { filename: "D:/repo/src/features/layouts/Sidebar/index.tsx", code: 'const v = globalThis.localStorage?.getItem("k")', errors: [{ messageId: "storage" }] },
      { filename: "D:/repo/src/hooks/session/useDraft.ts", code: 'window.sessionStorage.removeItem("k")', errors: [{ messageId: "storage" }] },
    ],
  })
})

test("FE-CLIENT-4: raw HTML only on a script", () => {
  tester.run("no-dangerous-html", noDangerousHtml, {
    valid: [
      { code: "const A = () => <script type=\"application/ld+json\" dangerouslySetInnerHTML={{ __html: JSON_LD }} />" },
      { code: "const A = () => <p>{text}</p>" },
      { filename: "D:/repo/src/components/blocks/Feed/index.test.tsx", code: "const A = () => <div dangerouslySetInnerHTML={{ __html: x }} />" },
    ],
    invalid: [
      { code: "const A = () => <div dangerouslySetInnerHTML={{ __html: html }} />", errors: [{ messageId: "html" }] },
      { code: "const A = () => <Article dangerouslySetInnerHTML={{ __html: html }} />", errors: [{ messageId: "html" }] },
      { code: "const A = () => <span dangerouslySetInnerHTML={{ __html: t('x') }} />", errors: [{ messageId: "html" }] },
    ],
  })
})
