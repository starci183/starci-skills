/**
 * Twin tests for the hooks-folder rule (HFS R56, lint half).
 *
 *   node --test hooks-folder.spec.mjs
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
      // the domain's entry is a file the slot names: it is not a stray helper
      { filename: at("apps/web/src/hooks/course/index.ts"), code: "export { useCourse } from \"./useCourse\"" },
      // the second app has its own hooks folder
      { filename: at("apps/admin/src/hooks/course/useCourse.ts"), code: "export const useCourse = () => 1" },
      // a folder named hooks that no slot owns is not judged by this rule
      { filename: at("apps/web/src/modules/hooks/x.ts"), code: "export const x = 1" },
      { filename: at("apps/web/src/components/blocks/Feed/hooks/helpers.ts"), code: "export const x = 1" },
      // outside hooks/, nothing is governed here
      { filename: at("apps/web/src/modules/api/graphql/queries/query-course.ts"), code: "export const queryCourse = () => 1" },
      { filename: at("apps/web/src/modules/i18n/request.ts"), code: "import \"server-only\"\nexport const request = () => 1" },
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

test("FE-HOOKS-2: each hooks family holds the files its slot names, one hook per hook file", () => {
  const SWR = "apps/web/src/hooks/swr"
  tester.run("hooks-folder-holds-hooks-only", hooksFolderHoldsHooksOnly, {
    valid: [
      // one SWR hook per modules/api operation, under the name its protocol and kind give it
      { filename: at(`${SWR}/api/graphql/queries/useQueryCourseSwr.ts`), code: "export const useQueryCourseSwr = () => 1" },
      { filename: at(`${SWR}/api/graphql/mutations/useMutateEnrollSwr.ts`), code: "export const useMutateEnrollSwr = () => 1" },
      // a hook file exports its SWR key beside the hook, so a mutation or a socket message revalidates that entry
      { filename: at(`${SWR}/api/graphql/queries/useQueryCourseSwr.ts`), code: "export const QUERY_COURSE_SWR_KEY = \"QUERY_COURSE_SWR\"\nexport const useQueryCourseSwr = () => 1" },
      { filename: at("apps/web/src/hooks/auth/useAuthUser.ts"), code: "export const AUTH_USER_SWR_KEY = \"AUTH_USER_SWR\"\nexport const useAuthUser = () => 1" },
      { filename: at(`${SWR}/api/rest/queries/useGetUploadSwr.ts`), code: "export const useGetUploadSwr = () => 1" },
      { filename: at(`${SWR}/api/rest/mutations/usePostUploadSwr.ts`), code: "export const usePostUploadSwr = () => 1" },
      // the family's barrels and its side-effect component (the one .tsx a family names) are not hook files
      { filename: at(`${SWR}/index.ts`), code: "export * from \"./api\"\nexport { SwrSideEffects } from \"./SwrSideEffects\"" },
      { filename: at(`${SWR}/api/graphql/queries/index.ts`), code: "export * from \"./useQueryCourseSwr\"" },
      { filename: at(`${SWR}/SwrSideEffects.tsx`), code: "export const SwrSideEffects = () => null" },
      { filename: at("apps/web/src/hooks/socketio/SocketIoSideEffects.tsx"), code: "export const SocketIoSideEffects = () => null" },
      // a form, a local store and its selector, the sockets and their enums and types, an effect, a reusable hook
      { filename: at("apps/web/src/hooks/rhf/useContactForm.ts"), code: "export const useContactForm = () => 1" },
      { filename: at("apps/web/src/hooks/zustand/cart/store.ts"), code: "export const useCartStore = create(() => ({}))\nexport type CartState = { n: number }" },
      { filename: at("apps/web/src/hooks/zustand/cart/useCartCount.ts"), code: "export const useCartCount = () => 1" },
      { filename: at("apps/web/src/hooks/socketio/sockets.ts"), code: "export const chatSocket = io(\"/chat\")\nexport const jobSocket = io(\"/jobs\")" },
      { filename: at("apps/web/src/hooks/socketio/enums/subscription-event.ts"), code: "export enum SubscriptionEvent { Message = \"message\" }" },
      { filename: at("apps/web/src/hooks/socketio/types/chat.ts"), code: "export type ChatMessage = { id: string }" },
      { filename: at("apps/web/src/hooks/socketio/useChatSocketIo.ts"), code: "export const useChatSocketIo = () => 1" },
      { filename: at("apps/web/src/hooks/effects/useSyncReduxCourseId.ts"), code: "export const useSyncReduxCourseId = () => 1" },
      { filename: at("apps/web/src/hooks/reuseables/useSmViewport.ts"), code: "export const useSmViewport = () => 1" },
    ],
    invalid: [
      // a name the family does not give: the wrong prefix for the folder, a hook outside api/, a helper, a .tsx outside the named ones
      { filename: at(`${SWR}/api/graphql/queries/useGetCourseSwr.ts`), code: "export const useGetCourseSwr = () => 1", errors: [{ messageId: "family" }] },
      { filename: at(`${SWR}/api/graphql/mutations/useQueryCourseSwr.ts`), code: "export const useQueryCourseSwr = () => 1", errors: [{ messageId: "family" }] },
      { filename: at(`${SWR}/useCourse.ts`), code: "export const useCourse = () => 1", errors: [{ messageId: "family" }] },
      { filename: at(`${SWR}/api/graphql/queries/keys.ts`), code: "export const QUERY_COURSE_SWR_KEY = \"course\"", errors: [{ messageId: "family" }] },
      { filename: at("apps/web/src/hooks/rhf/useContact.ts"), code: "export const useContact = () => 1", errors: [{ messageId: "family" }] },
      { filename: at("apps/web/src/hooks/rhf/contact-schema.ts"), code: "export const schema = 1", errors: [{ messageId: "family" }] },
      { filename: at("apps/web/src/hooks/effects/UseEffects.tsx"), code: "export const UseEffects = () => null", errors: [{ messageId: "family" }] },
      { filename: at("apps/web/src/hooks/socketio/SocketProvider.tsx"), code: "export const SocketProvider = () => null", errors: [{ messageId: "family" }] },
      { filename: at("apps/web/src/hooks/zustand/cart/helpers.ts"), code: "export const h = 1", errors: [{ messageId: "family" }] },
      // a hook file of a family exports one hook and nothing else
      { filename: at(`${SWR}/api/graphql/queries/useQueryCourseSwr.ts`), code: "export const useQueryCourseSwr = () => 1\nexport const useQueryLessonSwr = () => 2", errors: [{ messageId: "many" }] },
      { filename: at("apps/web/src/hooks/rhf/useContactForm.ts"), code: "export const useContactForm = () => 1\nexport const contactSchema = 2", errors: [{ messageId: "export" }] },
      // a constant that is not an SWR key is still a helper
      { filename: at(`${SWR}/api/graphql/queries/useQueryCourseSwr.ts`), code: "export const COURSE_PAGE_SIZE = 20\nexport const useQueryCourseSwr = () => 1", errors: [{ messageId: "export" }] },
      // server-only code is never a hook, in any family
      { filename: at(`${SWR}/api/graphql/queries/useQueryCourseSwr.ts`), code: "import \"server-only\"\nexport const useQueryCourseSwr = () => 1", errors: [{ messageId: "server" }] },
      { filename: at("apps/web/src/hooks/effects/useLocale.ts"), code: "import { headers } from \"next/headers\"\nexport const useLocale = () => headers()", errors: [{ messageId: "server" }] },
    ],
  })
})
