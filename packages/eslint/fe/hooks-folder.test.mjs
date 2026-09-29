/**
 * Twin tests for the hooks-folder rule (HFS R56, lint half).
 *
 *   node --test hooks-folder.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { RuleTester } from "eslint"
import tsParser from "@typescript-eslint/parser"
import { hooksFolderHoldsHooksOnly, rules } from "./hooks-folder.mjs"

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
})

const HOOK = "D:/repo/src/hooks/course/useCourse.ts"
const SHARED = "D:/repo/src/hooks/course/course.shared.ts"

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule && rule.meta && rule.create, `${name} is not a rule`)
})

test("FE-HOOKS-1: hooks/ holds hooks, one shared helper file per domain, and nothing else", () => {
  tester.run("hooks-folder-holds-hooks-only", hooksFolderHoldsHooksOnly, {
    valid: [
      { filename: HOOK, code: "export const useCourse = () => 1" },
      { filename: HOOK, code: "export function useCourse() { return 1 }" },
      { filename: HOOK, code: "export type CourseState = { id: string }\nexport const useCourse = () => 1" },
      // a private helper is an implementation detail of the hook
      { filename: HOOK, code: "const key = (id) => id\nexport const useCourse = () => key(1)" },
      { filename: SHARED, code: "export const courseKey = (id) => [\"course\", id]" },
      { filename: "D:/repo/src/hooks/course/useCourse.test.ts", code: "export const x = 1" },
      // outside hooks/, nothing is governed here
      { filename: "D:/repo/src/modules/api/course/read-course.ts", code: "import \"server-only\"\nexport const readCourse = () => 1" },
      { filename: "D:/repo/src/components/blocks/Feed/index.tsx", code: "export const Feed = () => null" },
    ],
    invalid: [
      { filename: "D:/repo/src/hooks/useCourse.ts", code: "export const useCourse = () => 1", errors: [{ messageId: "domain" }] },
      { filename: "D:/repo/src/hooks/course/readCourse.ts", code: "export const readCourse = () => 1", errors: [{ messageId: "notHook" }] },
      { filename: "D:/repo/src/hooks/course/useCourse.tsx", code: "export const useCourse = () => 1", errors: [{ messageId: "notHook" }] },
      { filename: "D:/repo/src/hooks/course/helpers.ts", code: "export const h = 1", errors: [{ messageId: "notHook" }] },
      // a shared file named for another domain is not this domain's
      { filename: "D:/repo/src/hooks/course/lesson.shared.ts", code: "export const h = 1", errors: [{ messageId: "notHook" }] },
      { filename: HOOK, code: "export const useCourse = () => 1\nexport const courseKey = () => 2", errors: [{ messageId: "export" }] },
      { filename: HOOK, code: "export const useCourse = () => 1\nexport const useLesson = () => 2", errors: [{ messageId: "many" }] },
      { filename: SHARED, code: "export const useCourseKey = () => 1", errors: [{ messageId: "sharedHook" }] },
      { filename: HOOK, code: "import \"server-only\"\nexport const useCourse = () => 1", errors: [{ messageId: "server" }] },
      { filename: HOOK, code: "import { headers } from \"next/headers\"\nexport const useCourse = () => headers()", errors: [{ messageId: "server" }] },
    ],
  })
})
