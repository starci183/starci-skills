/**
 * Twin tests for the client-boundary rule (HFS R55).
 *
 *   node --test client-boundary.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { rules, useClientOnlyAtBoundary } from "./client-boundary.mjs"

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
      { filename: "D:/repo/src/components/blocks/Feed/component.tsx", code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      { filename: "D:/repo/src/hooks/session/useSession.ts", code: DIRECTIVE, errors: [{ messageId: "elsewhere" }] },
      { filename: "D:/repo/src/modules/api/client.ts", code: "'use client'\nexport const x = 1", errors: [{ messageId: "elsewhere" }] },
    ],
  })
})
