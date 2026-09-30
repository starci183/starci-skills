/**
 * Twin tests for the hooks-folder rule (HFS R56, lint half).
 *
 *   node --test hooks-folder.test.mjs
 */
import assert from "node:assert/strict"
import test from "node:test"
import { at, slotTester } from "./fixtures/typed/tester.mjs"
import { hooksFolderHoldsHooksOnly, rules } from "./hooks-folder.mjs"

const tester = slotTester()

const HOOK = at("apps/web/src/hooks/course/useCourse.ts")
const SHARED = at("apps/web/src/hooks/course/course.shared.ts")

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
      { filename: at("apps/web/src/hooks/course/useCourse.test.ts"), code: "export const x = 1" },
      // the domain's entry is a file the slot names: it is not a stray helper
      { filename: at("apps/web/src/hooks/course/index.ts"), code: "export { useCourse } from \"./useCourse\"" },
      { filename: at("apps/web/src/hooks/course/index.spec.ts"), code: "export const x = 1" },
      // the second app has its own hooks folder
      { filename: at("apps/admin/src/hooks/course/useCourse.ts"), code: "export const useCourse = () => 1" },
      // a folder named hooks that no slot owns is not judged by this rule
      { filename: at("apps/web/src/modules/hooks/x.ts"), code: "export const x = 1" },
      { filename: at("apps/web/src/components/blocks/Feed/hooks/helpers.ts"), code: "export const x = 1" },
      // outside hooks/, nothing is governed here
      { filename: at("apps/web/src/modules/api/course/read-course.ts"), code: "import \"server-only\"\nexport const readCourse = () => 1" },
      { filename: at("apps/web/src/components/blocks/Feed/index.tsx"), code: "export const Feed = () => null" },
    ],
    invalid: [
      { filename: at("apps/web/src/hooks/useCourse.ts"), code: "export const useCourse = () => 1", errors: [{ messageId: "domain" }] },
      { filename: at("apps/web/src/hooks/course/readCourse.ts"), code: "export const readCourse = () => 1", errors: [{ messageId: "notHook" }] },
      { filename: at("apps/web/src/hooks/course/useCourse.tsx"), code: "export const useCourse = () => 1", errors: [{ messageId: "notHook" }] },
      { filename: at("apps/web/src/hooks/course/helpers.ts"), code: "export const h = 1", errors: [{ messageId: "notHook" }] },
      // a shared file named for another domain is not this domain's
      { filename: at("apps/web/src/hooks/course/lesson.shared.ts"), code: "export const h = 1", errors: [{ messageId: "notHook" }] },
      { filename: HOOK, code: "export const useCourse = () => 1\nexport const courseKey = () => 2", errors: [{ messageId: "export" }] },
      { filename: HOOK, code: "export const useCourse = () => 1\nexport const useLesson = () => 2", errors: [{ messageId: "many" }] },
      { filename: SHARED, code: "export const useCourseKey = () => 1", errors: [{ messageId: "sharedHook" }] },
      { filename: HOOK, code: "import \"server-only\"\nexport const useCourse = () => 1", errors: [{ messageId: "server" }] },
      { filename: HOOK, code: "import { headers } from \"next/headers\"\nexport const useCourse = () => headers()", errors: [{ messageId: "server" }] },
    ],
  })
})
