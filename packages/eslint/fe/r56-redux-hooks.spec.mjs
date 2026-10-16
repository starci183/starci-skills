import fs from "node:fs"
import test from "node:test"
import { projectFixture } from "../be/fixtures/project/tester.mjs"
import { hooksFolderHoldsHooksOnly } from "./hooks-folder.mjs"

// proves: FE_HOOKS_ARE_HOOKS@lite FE_HOOKS_ARE_HOOKS@full
const base = "packages/hfs/templates/fe/skeleton/apps/__app__/src/"
const session = fs.readFileSync(base + "hooks/auth/useSession.ts", "utf8")
const redux = fs.readFileSync(base + "redux/hooks.ts", "utf8")
for (const edition of ["lite", "full"]) {
  test(`R56 ${edition} accepts canonical typed Redux hooks and rejects non-hooks`, t => {
    const filename = "apps/web/src/hooks/auth/useSession.ts"
    const files = {
      "tsconfig.json": JSON.stringify({ compilerOptions: { moduleResolution: "Bundler", module: "ESNext", baseUrl: ".", paths: { "@/*": ["apps/web/src/*"] } }, include: ["apps/**/*"] }),
      [filename]: session,
      "apps/web/src/redux/hooks.ts": redux,
      "apps/web/src/redux/index.ts": fs.readFileSync(base + "redux/index.ts", "utf8") + '\nexport { useFake } from "./fake"; export { useAppSelector as useReader } from "./reader";',
      "apps/web/src/redux/fake.ts": "export const useAppSelector = { withTypes: () => () => 1 }; export const useFake = useAppSelector.withTypes();",
      "apps/web/src/redux/reader.ts": "export const useAppSelector = () => 1;",
    }
    const { tester, at, cleanup } = projectFixture({ profile: "fe", edition, files })
    t.after(cleanup)
    tester.run("hooks-folder-holds-hooks-only", hooksFolderHoldsHooksOnly, {
      valid: [
        { filename: at(filename), code: session },
        { filename: at(filename), code: "import { useAppDispatch as dispatchHook } from '../../redux'; export const useSession = () => dispatchHook();" },
      ],
      invalid: [
        { filename: at(filename), code: "import { useAppSelector } from '../../redux'; export const useSession = (useAppSelector) => useAppSelector();", errors: [{ messageId: "fake" }] },
        { filename: at(filename), code: "import { useAppSelector } from '../../redux/reader'; export const useSession = () => useAppSelector();", errors: [{ messageId: "fake" }] },
        { filename: at(filename), code: "import { useFake } from '../../redux/fake'; export const useSession = () => useFake();", errors: [{ messageId: "fake" }] },
        { filename: at(filename), code: "export const useSession = () => 1;", errors: [{ messageId: "fake" }] },
      ],
    })
  })
}

// Owner ruling 2026-10-16 "Theo y tro": a composite hook that stands on the app's own hooks (a wrapper of hooks/swr, a hook of a
// sibling domain) or on a listed library hook (next-intl...) is a hook; a file that exports a non-hook still fails.
for (const edition of ["lite", "full"]) {
  test(`R56 ${edition} accepts composite hooks over own hooks and library hooks, and still refuses non-hooks`, t => {
    const filename = "apps/web/src/hooks/admin/useAdminSession.ts"
    const files = {
      "tsconfig.json": JSON.stringify({ compilerOptions: { moduleResolution: "Bundler", module: "ESNext", baseUrl: ".", jsx: "preserve", paths: { "@/*": ["apps/web/src/*"] } }, include: ["apps/**/*"] }),
      [filename]: "export const useAdminSession = () => 1",
      "apps/web/src/hooks/swr/index.ts": 'export * from "./api/graphql/queries"',
      "apps/web/src/hooks/swr/api/graphql/queries/index.ts": 'export { useQueryAdminSessionSwr } from "./useQueryAdminSessionSwr"',
      "apps/web/src/hooks/swr/api/graphql/queries/useQueryAdminSessionSwr.ts": 'import request from "swr"; export const useQueryAdminSessionSwr = () => request("session")',
      "apps/web/src/hooks/account/useAccountMethods.ts": 'import { useTranslations } from "next-intl"; export const useAccountMethods = () => useTranslations("account")',
      "apps/web/src/hooks/account/account.shared.ts": "export const useShaped = () => 1",
      "apps/web/src/lib/useOutside.ts": "export const useOutside = () => 1",
      "apps/web/src/lib/helper.ts": "export const adminFailureOf = () => 1",
      "apps/web/src/components/useComponentHook.ts": 'import { useState } from "react"; export const useComponentHook = () => useState(1)',
    }
    const { tester, at, cleanup } = projectFixture({ profile: "fe", edition, files })
    t.after(cleanup)
    const wrapper = 'import { useQueryAdminSessionSwr } from "@/hooks/swr"; import { adminFailureOf } from "../../lib/helper"; '
    tester.run("hooks-folder-holds-hooks-only", hooksFolderHoldsHooksOnly, {
      valid: [
        // the composite hook over a hooks/swr wrapper (through the barrel), and over a sibling domain hook by a relative path
        { filename: at(filename), code: wrapper + "export const useAdminSession = () => { const query = useQueryAdminSessionSwr(); return adminFailureOf(query) }" },
        { filename: at(filename), code: 'import { useAccountMethods } from "../account/useAccountMethods"; export const useAdminSession = () => useAccountMethods()' },
        { filename: at(filename), code: 'import { useQueryAdminSessionSwr as read } from "@/hooks/swr"; export const useAdminSession = () => read()' },
        // the composite hook over next-intl, and the other listed library hooks
        { filename: at(filename), code: 'import { useTranslations } from "next-intl"; export const useAdminSession = () => useTranslations("admin")' },
        { filename: at(filename), code: 'import { useLocale } from "next-intl"; export const useAdminSession = () => useLocale()' },
        { filename: at(filename), code: 'import * as Intl from "next-intl"; export const useAdminSession = () => Intl.useTranslations("admin")' },
        { filename: at(filename), code: 'import { useRouter } from "next/navigation"; export const useAdminSession = () => useRouter()' },
        { filename: at(filename), code: 'import { useForm } from "react-hook-form"; export const useAdminSession = () => useForm()' },
      ],
      invalid: [
        // a use* name from outside every hooks folder, or an unlisted library, is not a hook by its spelling
        { filename: at(filename), code: 'import { useOutside } from "../../lib/useOutside"; export const useAdminSession = () => useOutside()', errors: [{ messageId: "fake" }] },
        { filename: at(filename), code: 'import { useComponentHook } from "../../components/useComponentHook"; export const useAdminSession = () => useComponentHook()', errors: [{ messageId: "fake" }] },
        { filename: at(filename), code: 'import { useUnlisted } from "next-intl"; export const useAdminSession = () => useUnlisted()', errors: [{ messageId: "fake" }] },
        { filename: at(filename), code: 'import { useSomething } from "left-pad"; export const useAdminSession = () => useSomething()', errors: [{ messageId: "fake" }] },
        { filename: at(filename), code: 'import { useMissing } from "@/hooks/swr"; export const useAdminSession = () => useMissing()', errors: [{ messageId: "fake" }] },
        { filename: at(filename), code: 'import type { useQueryAdminSessionSwr } from "@/hooks/swr"; export const useAdminSession = () => useQueryAdminSessionSwr()', errors: [{ messageId: "fake" }] },
        { filename: at(filename), code: 'import { adminFailureOf } from "../../lib/helper"; export const useAdminSession = () => adminFailureOf()', errors: [{ messageId: "fake" }] },
        // a file that exports a non-hook beside the composite hook still fails
        { filename: at(filename), code: wrapper + "export const ADMIN_LABEL = 'admin'; export const useAdminSession = () => useQueryAdminSessionSwr()", errors: [{ messageId: "export" }] },
        { filename: at(filename), code: wrapper + "export const adminHelper = () => 1; export const useAdminSession = () => useQueryAdminSessionSwr()", errors: [{ messageId: "export" }] },
        { filename: at(filename), code: wrapper + "export const AdminBadge = () => null; export const useAdminSession = () => useQueryAdminSessionSwr()", errors: [{ messageId: "export" }] },
        // a hook in the shared helper file is still refused
        { filename: at("apps/web/src/hooks/account/account.shared.ts"), code: wrapper + "export const useShaped = () => useQueryAdminSessionSwr()", errors: [{ messageId: "sharedHook" }] },
      ],
    })
  })
}
