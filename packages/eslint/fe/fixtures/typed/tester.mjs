/**
 * The typed rule tester of the front-end canon: RuleTester over @typescript-eslint/parser with the project service on this
 * directory's tsconfig.json (JSX on), and `settings.starci.hfs` built from an in-memory hfs.json - the same inputs
 * starciFeConfig gives a repository. A case's `filename` is `at("apps/web/src/hooks/lesson/useLesson.ts")`: the file need not
 * exist; its slot comes from its path and its types from the library stubs in ./node_modules.
 */
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import tsParser from "@typescript-eslint/parser"
import { RuleTester } from "eslint"
import { hfsFromDeclaration } from "../../lib/hfs.mjs"
import { appDeclaration } from "../../../be/fixtures/app.mjs"

/** The fixture repository root. */
export const TYPED_ROOT = dirname(fileURLToPath(import.meta.url))

/** The default fe side of the fixture app (hfs.json sides.fe): two apps and the shared packages. */
export const FE_DECLARATION = Object.freeze({
  apps: [{ name: "web", kind: "next" }, { name: "admin", kind: "next" }],
  optionalSlots: ["repo.packages", "fe.package.ui", "fe.package.api", "fe.package.i18n"],
})

/** The HFS view of the fixture fe side (`declaration` is the fe side of the app). */
export const fixtureHfs = (declaration = FE_DECLARATION) => hfsFromDeclaration(appDeclaration("fe", declaration), TYPED_ROOT)

/** Globs of every depth a case filename may sit at (the project service refuses a `**` glob). */
const DEPTHS = Array.from({ length: 10 }, (_, depth) => [`${"*/".repeat(depth)}*.ts`, `${"*/".repeat(depth)}*.tsx`]).flat()

/** The absolute filename of a fixture-relative path. */
export const at = (rel) => join(TYPED_ROOT, rel)

/** A RuleTester with typed linting, JSX and the fixture HFS settings. */
export const typedTester = ({ declaration } = {}) => new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
      // A case's file need not exist: the default project types it with this directory's tsconfig.json.
      projectService: { allowDefaultProject: DEPTHS, defaultProject: "tsconfig.json", maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 1000 },
      tsconfigRootDir: TYPED_ROOT,
    },
  },
  settings: { starci: { hfs: fixtureHfs(declaration) } },
})

/** A RuleTester with the fixture HFS settings and a syntax-only parser, for rules that read slots but no types. */
export const slotTester = ({ declaration } = {}) => new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
  settings: { starci: { hfs: fixtureHfs(declaration) } },
})
