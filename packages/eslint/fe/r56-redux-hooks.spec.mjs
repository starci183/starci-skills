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
