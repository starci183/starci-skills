/**
 * Twin tests for the file-layout rules.
 *
 *   node --test file-layout.test.mjs
 *
 * These rules read the PATH, so the cases that matter are the ones where a path looks governed and
 * is not. A path rule that widens by one segment starts firing on a whole tier at once.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import {
  exportMatchesFolder,
  noHelperFolderInComponents,
  noRuntimeNamespace,
  rules,
  surfaceFolderTwoFilesOnly,
} from "./file-layout.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const R = "D:/repo/src/components"

test("every rule this law declares is exported under its published name", () => {
  for (const [name, rule] of Object.entries(rules)) {
    assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
  }
})

test("LAYOUT-2: a surface folder holds its two halves and their twins", () => {
  tester.run("surface-folder-two-files-only", surfaceFolderTwoFilesOnly, {
    valid: [
      { filename: `${R}/pages/DashboardPage/index.tsx`, code: "export const P = () => null" },
      { filename: `${R}/pages/DashboardPage/component.tsx`, code: "export const P = () => null" },
      { filename: `${R}/pages/DashboardPage/component.test.tsx`, code: "export const P = () => null" },
      { filename: `${R}/overlays/auth/SignInOverlay/index.tsx`, code: "export const O = () => null" },
      // blocks and composites are NOT surface folders - they may hold more than two files
      { filename: `${R}/blocks/dashboard/DailyQuest/parts.tsx`, code: "export const X = () => null" },
    ],
    invalid: [
      {
        filename: `${R}/pages/DashboardPage/DailyQuest.tsx`,
        code: "export const X = () => null",
        errors: [{ messageId: "extra" }],
      },
      {
        filename: `${R}/layouts/ShellNav/utils/format.ts`,
        code: "export const f = () => null",
        errors: [{ messageId: "extra" }],
      },
    ],
  })
})

test("LAYOUT-3: a helper folder under components has a real home elsewhere", () => {
  tester.run("no-helper-folder-in-components", noHelperFolderInComponents, {
    valid: [
      { filename: `${R}/leaves/Text/index.tsx`, code: "export const T = () => null" },
      { filename: "D:/repo/src/modules/utils/format.ts", code: "export const f = () => null" },
      { filename: "D:/repo/src/hooks/swr/useX.ts", code: "export const useX = () => null" },
    ],
    invalid: [
      {
        filename: `${R}/blocks/dashboard/DailyQuest/utils/format.ts`,
        code: "export const f = () => null",
        errors: [{ messageId: "helper" }],
      },
      {
        filename: `${R}/leaves/Text/constants/tone.ts`,
        code: "export const TONE = 1",
        errors: [{ messageId: "helper" }],
      },
    ],
  })
})

test("LAYOUT-1: the path predicts the name", () => {
  tester.run("export-matches-folder", exportMatchesFolder, {
    valid: [
      { filename: `${R}/leaves/Text/index.tsx`, code: "export const Text = () => null" },
      { filename: `${R}/leaves/Text/index.tsx`, code: "export const TextLink = () => null" },
      // a file exporting nothing has nothing to disagree with
      { filename: `${R}/leaves/Text/index.tsx`, code: "const Text = () => null" },
      // not a PascalCase component folder
      { filename: "D:/repo/src/hooks/swr/index.ts", code: "export const useX = () => null" },
    ],
    invalid: [
      {
        filename: `${R}/leaves/Text/index.tsx`,
        code: "export const Paragraph = () => null",
        errors: [{ messageId: "mismatch" }],
      },
    ],
  })
})

test("LAYOUT-4: a family is exported as members, not as one object", () => {
  tester.run("no-runtime-namespace", noRuntimeNamespace, {
    valid: [
      "export const CardRoot = () => null",
      // data, not a component family - the members are not component-shaped names
      'export const TONE = { muted: "a", accent: "b" }',
      // one member is not a namespace
      "export const Card = { Root: CardRoot }",
    ],
    invalid: [
      {
        code: "export const Card = { Root: CardRoot, Header: CardHeader }",
        errors: [{ messageId: "namespace" }],
      },
      {
        code: "export const Chip = { Dot: ChipDot, Label: ChipLabel } as const",
        errors: [{ messageId: "namespace" }],
      },
    ],
  })
})
