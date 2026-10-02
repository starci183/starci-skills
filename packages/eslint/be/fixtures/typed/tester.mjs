/**
 * The typed rule tester: RuleTester over @typescript-eslint/parser with the project service on this directory's
 * tsconfig.json, and `settings.starci.hfs` built from an in-memory hfs.json - the same inputs starciBeConfig gives a
 * repository. A case's `filename` is `at("src/modules/domain/order/order.service.ts")`: the file need not exist; the
 * slot comes from its path and the types from the ambient stubs in ./types.
 */
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import tsParser from "@typescript-eslint/parser"
import { RuleTester } from "eslint"
import { hfsFromDeclaration } from "../../lib/hfs.mjs"
import { appDeclaration } from "../app.mjs"

/** The fixture repository root. */
export const TYPED_ROOT = dirname(fileURLToPath(import.meta.url))

/** The default be side of the fixture app (hfs.json sides.be). */
export const BE_DECLARATION = Object.freeze({
    apps: [{ name: "api", kind: "api" }, { name: "cli", kind: "cli" }],
    connections: [{ name: "primary", envPrefix: "PRIMARY_DB", owner: "api", isolation: "database" }],
})

/** The HFS view of the fixture be side (`declaration` is the be side of the app). */
export const fixtureHfs = (declaration = BE_DECLARATION) => hfsFromDeclaration(appDeclaration("be", declaration), TYPED_ROOT)

/** Globs of every depth a case filename may sit at, per extension (the project service refuses a `**` glob). */
export const depthsOf = (extensions = ["ts"], maxDepth = 8) =>
    Array.from({ length: maxDepth }, (_, depth) => extensions.map((ext) => `${"*/".repeat(depth)}*.${ext}`)).flat()

/** The absolute filename of a fixture-relative path. */
export const at = (rel) => join(TYPED_ROOT, rel)

/** The one typed RuleTester both canons build: the project service on the fixture root's tsconfig, the fixture
 *  HFS in settings; the front end passes jsx, a .tsx second extension and its own depth and project cap. */
export const ruleTester = ({ root, hfs, jsx = false, extensions = ["ts"], maxDepth = 8, maxProjects = 500 }) => new RuleTester({
    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: "module",
        parserOptions: {
            ...(jsx ? { ecmaFeatures: { jsx: true } } : {}),
            // A case's file need not exist: the default project types it with this directory's tsconfig.json.
            projectService: { allowDefaultProject: depthsOf(extensions, maxDepth), defaultProject: "tsconfig.json", maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: maxProjects },
            tsconfigRootDir: root,
        },
    },
    settings: { starci: { hfs } },
})

/** A RuleTester with typed linting and the fixture HFS settings. */
export const typedTester = ({ declaration } = {}) => ruleTester({ root: TYPED_ROOT, hfs: fixtureHfs(declaration) })
