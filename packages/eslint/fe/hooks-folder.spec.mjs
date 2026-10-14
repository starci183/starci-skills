/**
 * Twin tests for the hooks-folder rule (HFS R56, lint half).
 *
 *   node --test hooks-folder.spec.mjs
 */
// proves: FE_HOOKS_ARE_HOOKS@lite FE_HOOKS_ARE_HOOKS@full
import assert from "node:assert/strict"
import test from "node:test"
import { at, fixtureHfs, slotTester } from "./fixtures/typed/tester.mjs"
import { hooksFolderHoldsHooksOnly, rules } from "./hooks-folder.mjs"

const tester = slotTester()

const HOOK = at("apps/web/src/hooks/course/useCourse.ts")
const SHARED = at("apps/web/src/hooks/course/course.shared.ts")
const react = (code) => `import { useState } from "react"\n${code}`

test("every rule this law declares is a rule", () => {
  for (const [name, rule] of Object.entries(rules)) assert.ok(rule?.meta && rule.create, `${name} is not a rule`)
})

test("FE-HOOKS-1: hooks/ holds hooks, one shared helper file per domain, and nothing else", () => {
  tester.run("hooks-folder-holds-hooks-only", hooksFolderHoldsHooksOnly, {
    valid: [
      { filename: HOOK, code: react("export const useCourse = () => useState(1)") },
      { filename: HOOK, code: react("export function useCourse() { return useState(1) }") },
      { filename: HOOK, code: react("export type CourseState = { id: string }\nexport const useCourse = () => useState(1)") },
      // a private helper is an implementation detail of the hook
      { filename: HOOK, code: react("const key = (id) => id\nexport const useCourse = () => useState(key(1))") },
      { filename: SHARED, code: "export const courseKey = (id) => [\"course\", id]" },
      // the domain's entry is a file the slot names: it is not a stray helper
      { filename: at("apps/web/src/hooks/course/index.ts"), code: "export { useCourse } from \"./useCourse\"" },
      // the second app has its own hooks folder
      { filename: at("apps/admin/src/hooks/course/useCourse.ts"), code: react("export const useCourse = () => useState(1)") },
      // a folder named hooks that no slot owns is not judged by this rule
      { filename: at("apps/web/src/modules/hooks/x.ts"), code: "export const x = 1" },
      { filename: at("apps/web/src/components/blocks/Feed/hooks/helpers.ts"), code: "export const x = 1" },
      // outside hooks/, nothing is governed here
      { filename: at("apps/web/src/modules/api/graphql/queries/query-course.ts"), code: "export const queryCourse = () => 1" },
      { filename: at("apps/web/src/modules/i18n/request.ts"), code: "import \"server-only\"\nexport const request = () => 1" },
      { filename: at("apps/web/src/components/blocks/Feed/index.tsx"), code: "export const Feed = () => null" },
    ],
    invalid: [
      { filename: at("apps/web/src/hooks/useCourse.ts"), code: react("export const useCourse = () => useState(1)"), errors: [{ messageId: "domain" }] },
      { filename: at("apps/web/src/hooks/course/readCourse.ts"), code: "export const readCourse = () => 1", errors: [{ messageId: "notHook" }] },
      { filename: at("apps/web/src/hooks/course/useCourse.tsx"), code: react("export const useCourse = () => useState(1)"), errors: [{ messageId: "notHook" }] },
      { filename: at("apps/web/src/hooks/course/helpers.ts"), code: "export const h = 1", errors: [{ messageId: "notHook" }] },
      // a shared file named for another domain is not this domain's
      { filename: at("apps/web/src/hooks/course/lesson.shared.ts"), code: "export const h = 1", errors: [{ messageId: "notHook" }] },
      { filename: HOOK, code: react("export const useCourse = () => useState(1)\nexport const courseKey = () => useState(2)"), errors: [{ messageId: "export" }] },
      { filename: HOOK, code: react("export const useCourse = () => useState(1)\nexport const useLesson = () => useState(2)"), errors: [{ messageId: "many" }] },
      { filename: SHARED, code: react("export const useCourseKey = () => useState(1)"), errors: [{ messageId: "sharedHook" }] },
      { filename: HOOK, code: react("import \"server-only\"\nexport const useCourse = () => useState(1)"), errors: [{ messageId: "server" }] },
      { filename: HOOK, code: react("import { headers } from \"next/headers\"\nexport const useCourse = () => { useState(1); return headers() }"), errors: [{ messageId: "server" }] },
    ],
  })
})

test("FE-HOOKS-2: each hooks family holds the files its slot names, one hook per hook file", () => {
  const SWR = "apps/web/src/hooks/swr"
  tester.run("hooks-folder-holds-hooks-only", hooksFolderHoldsHooksOnly, {
    valid: [
      // one SWR hook per modules/api operation, under the name its protocol and kind give it
      { filename: at(`${SWR}/api/graphql/queries/useQueryCourseSwr.ts`), code: react("export const useQueryCourseSwr = () => useState(1)") },
      { filename: at(`${SWR}/api/graphql/mutations/useMutateEnrollSwr.ts`), code: react("export const useMutateEnrollSwr = () => useState(1)") },
      // a hook file exports its SWR key beside the hook, so a mutation or a socket message revalidates that entry
      { filename: at(`${SWR}/api/graphql/queries/useQueryCourseSwr.ts`), code: react("export const QUERY_COURSE_SWR_KEY = \"QUERY_COURSE_SWR\"\nexport const useQueryCourseSwr = () => useState(1)") },
      { filename: at("apps/web/src/hooks/auth/useAuthUser.ts"), code: react("export const AUTH_USER_SWR_KEY = \"AUTH_USER_SWR\"\nexport const useAuthUser = () => useState(1)") },
      { filename: at(`${SWR}/api/rest/queries/useGetUploadSwr.ts`), code: react("export const useGetUploadSwr = () => useState(1)") },
      { filename: at(`${SWR}/api/rest/mutations/usePostUploadSwr.ts`), code: react("export const usePostUploadSwr = () => useState(1)") },
      // the family's barrels and its side-effect component (the one .tsx a family names) are not hook files
      { filename: at(`${SWR}/index.ts`), code: "export * from \"./api\"\nexport { SwrSideEffects } from \"./SwrSideEffects\"" },
      { filename: at(`${SWR}/api/graphql/queries/index.ts`), code: "export * from \"./useQueryCourseSwr\"" },
      { filename: at(`${SWR}/SwrSideEffects.tsx`), code: "export const SwrSideEffects = () => null" },
      { filename: at("apps/web/src/hooks/socketio/SocketIoSideEffects.tsx"), code: "export const SocketIoSideEffects = () => null" },
      // a form, a local store and its selector, the sockets and their enums and types, an effect, a reusable hook
      { filename: at("apps/web/src/hooks/rhf/useContactForm.ts"), code: react("export const useContactForm = () => useState(1)") },
      { filename: at("apps/web/src/hooks/zustand/cart/store.ts"), code: "export const useCartStore = create(() => ({}))\nexport type CartState = { n: number }" },
      { filename: at("apps/web/src/hooks/zustand/cart/useCartCount.ts"), code: react("export const useCartCount = () => useState(1)") },
      { filename: at("apps/web/src/hooks/socketio/sockets.ts"), code: "export const chatSocket = io(\"/chat\")\nexport const jobSocket = io(\"/jobs\")" },
      { filename: at("apps/web/src/hooks/socketio/enums/subscription-event.ts"), code: "export enum SubscriptionEvent { Message = \"message\" }" },
      { filename: at("apps/web/src/hooks/socketio/types/chat.ts"), code: "export type ChatMessage = { id: string }" },
      { filename: at("apps/web/src/hooks/socketio/useChatSocketIo.ts"), code: react("export const useChatSocketIo = () => useState(1)") },
      { filename: at("apps/web/src/hooks/effects/useSyncReduxCourseId.ts"), code: react("export const useSyncReduxCourseId = () => useState(1)") },
      { filename: at("apps/web/src/hooks/reuseables/useSmViewport.ts"), code: react("export const useSmViewport = () => useState(1)") },
    ],
    invalid: [
      // a name the family does not give: the wrong prefix for the folder, a hook outside api/, a helper, a .tsx outside the named ones
      { filename: at(`${SWR}/api/graphql/queries/useGetCourseSwr.ts`), code: react("export const useGetCourseSwr = () => useState(1)"), errors: [{ messageId: "family" }] },
      { filename: at(`${SWR}/api/graphql/mutations/useQueryCourseSwr.ts`), code: react("export const useQueryCourseSwr = () => useState(1)"), errors: [{ messageId: "family" }] },
      { filename: at(`${SWR}/useCourse.ts`), code: react("export const useCourse = () => useState(1)"), errors: [{ messageId: "family" }] },
      { filename: at(`${SWR}/api/graphql/queries/keys.ts`), code: "export const QUERY_COURSE_SWR_KEY = \"course\"", errors: [{ messageId: "family" }] },
      { filename: at("apps/web/src/hooks/rhf/useContact.ts"), code: react("export const useContact = () => useState(1)"), errors: [{ messageId: "family" }] },
      { filename: at("apps/web/src/hooks/rhf/contact-schema.ts"), code: "export const schema = 1", errors: [{ messageId: "family" }] },
      { filename: at("apps/web/src/hooks/effects/UseEffects.tsx"), code: "export const UseEffects = () => null", errors: [{ messageId: "family" }] },
      { filename: at("apps/web/src/hooks/socketio/SocketProvider.tsx"), code: "export const SocketProvider = () => null", errors: [{ messageId: "family" }] },
      { filename: at("apps/web/src/hooks/zustand/cart/helpers.ts"), code: "export const h = 1", errors: [{ messageId: "family" }] },
      // a hook file of a family exports one hook and nothing else
      { filename: at(`${SWR}/api/graphql/queries/useQueryCourseSwr.ts`), code: react("export const useQueryCourseSwr = () => useState(1)\nexport const useQueryLessonSwr = () => useState(2)"), errors: [{ messageId: "many" }] },
      { filename: at("apps/web/src/hooks/rhf/useContactForm.ts"), code: react("export const useContactForm = () => useState(1)\nexport const contactSchema = 2"), errors: [{ messageId: "export" }] },
      // a constant that is not an SWR key is still a helper
      { filename: at(`${SWR}/api/graphql/queries/useQueryCourseSwr.ts`), code: react("export const COURSE_PAGE_SIZE = 20\nexport const useQueryCourseSwr = () => useState(1)"), errors: [{ messageId: "export" }] },
      // server-only code is never a hook, in any family
      { filename: at(`${SWR}/api/graphql/queries/useQueryCourseSwr.ts`), code: react("import \"server-only\"\nexport const useQueryCourseSwr = () => useState(1)"), errors: [{ messageId: "server" }] },
      { filename: at("apps/web/src/hooks/effects/useLocale.ts"), code: react("import { headers } from \"next/headers\"\nexport const useLocale = () => { useState(1); return headers() }"), errors: [{ messageId: "server" }] },
    ],
  })
})

for (const edition of ["lite", "full"]) {
  test(`R56: zero-hook, default-export and fake use* files are refused (${edition})`, () => {
    const settings = { starci: { hfs: fixtureHfs(undefined, { lite: edition === "lite" }) } }
    const entry = (code, filename = HOOK) => ({ filename, code, settings })
    const refused = (code, messageId, filename = HOOK) => ({ ...entry(code, filename), errors: [{ messageId }] })
    tester.run("hooks-folder-holds-hooks-only", hooksFolderHoldsHooksOnly, {
      valid: [
        entry(react("export const useCourse = () => useState(1)")),
        entry(react("export function useCourse() { return useState(1) }")),
        entry("import { useState as state } from 'react'; const course = () => state(1); export { course as useCourse }"),
        entry("import { useState } from 'react'; const state = useState; export const useCourse = () => state(1)"),
        entry("import React from 'react'; export const useCourse = () => React.useState(1)"),
        entry("import * as React from 'react'; const hooks = React; export const useCourse = () => hooks['useState'](1)"),
        entry("import * as React from 'react'; const { useState: state } = React; export const useCourse = () => state(1)"),
        entry("import { use } from 'react'; export const useCourse = () => use(Promise.resolve(1))"),
        entry(react("type useCourseType = number; export type { useCourseType }; export const useCourse = () => useState(1)")),
        entry(react("type useCourseType = number; export { type useCourseType }; export const useCourse = () => useState(1)")),
        entry("import request from 'swr'; export const QUERY_COURSE_SWR_KEY = 'course'; export const useQueryCourseSwr = () => request(QUERY_COURSE_SWR_KEY)", at("apps/web/src/hooks/swr/api/graphql/queries/useQueryCourseSwr.ts")),
        entry("import { default as request } from 'swr'; export const useCourse = () => request('course')"),
        entry("import * as SWR from 'swr'; export const useCourse = () => SWR.default('course')"),
        entry("import * as SWR from 'swr'; const { default: request } = SWR; export const useCourse = () => request('course')"),
        entry("import { useSWRConfig as config } from 'swr'; export const useCourse = () => config()"),
        entry("import request from 'swr/immutable'; export const useCourse = () => request('course')"),
        entry("import request from 'swr/infinite'; export const useCourse = () => request(() => 'course')"),
        entry("import request from 'swr/mutation'; export const useCourse = () => request('course', () => 1)"),
      ],
      invalid: [
        refused("const privateHelper = () => 1", "missing"),
        refused("export const QUERY_COURSE_SWR_KEY = 'course'", "missing"),
        refused("export type useCourse = number", "missing"),
        refused("export default async function readCourse() { return 1 }", "defaultExport"),
        refused(react("export default function useCourse() { return useState(1) }"), "defaultExport"),
        refused(react("export const useCourse = () => useState(1); export default useCourse"), "defaultExport"),
        refused(react("const useCourse = () => useState(1); export { useCourse as default }"), "defaultExport"),
        refused("export const useCourse = () => 1", "fake"),
        refused("export const useCourse = 1", "fake"),
        refused("const useState = () => 1; export const useCourse = () => useState()", "fake"),
        refused("import { useState } from './helpers'; export const useCourse = () => useState(1)", "fake"),
        refused("import { useFake } from 'react'; export const useCourse = () => useFake()", "fake"),
        refused("import useFake from 'swr/helpers'; export const useCourse = () => useFake()", "fake"),
        refused("import { useSWR } from 'swr'; export const useCourse = () => useSWR('course')", "fake"),
        refused("import * as SWR from 'swr'; export const useCourse = () => SWR.useSWR('course')", "fake"),
        refused("import type { useState } from 'react'; export const useCourse = () => useState(1)", "fake"),
        refused("import { type useState } from 'react'; export const useCourse = () => useState(1)", "fake"),
        refused(react("export const useCourse = (useState) => useState(1)"), "fake"),
        refused("import React from 'react'; export const useCourse = (React) => React.useState(1)", "fake"),
        refused(react("const state = useState; export const useCourse = (state) => state(1)"), "fake"),
        refused(react("let state = useState; state = () => 1; export const useCourse = () => state(1)"), "fake"),
        refused(react("useState(1); export const useCourse = () => 1"), "fake"),
        refused(react("export const useCourse = () => { const unused = () => useState(1); return 1 }"), "fake"),
        refused(react("export const useCourse = () => { function unused() { return useState(1) }; return 1 }"), "fake"),
        refused("import { useState as useCourse } from 'react'; export { useCourse }", "fake"),
        refused("export { useState as useCourse } from 'react'", "fake"),
        refused("const React = { useState: () => 1 }; export const useCourse = () => React.useState()", "fake"),
        refused("import React from 'react'; const method = 'useState'; export const useCourse = () => React[method](1)", "fake"),
      ],
    })
  })
}
