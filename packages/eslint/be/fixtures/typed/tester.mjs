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

/** The fixture repository root. */
export const TYPED_ROOT = dirname(fileURLToPath(import.meta.url))

/** The default back-end declaration of the fixture repository. */
export const BE_DECLARATION = Object.freeze({
    hfs: 1,
    profile: "be",
    project: "fixture",
    apps: [{ name: "api", kind: "api" }, { name: "migrate", kind: "migrate" }],
    connections: [{ name: "primary", envPrefix: "PRIMARY_DB" }],
})

/** The HFS view of the fixture repository. */
export const fixtureHfs = (declaration = BE_DECLARATION) => hfsFromDeclaration(declaration, TYPED_ROOT)

/** Globs of every depth a case filename may sit at (the project service refuses a `**` glob). */
const DEPTHS = ["*.ts", "*/*.ts", "*/*/*.ts", "*/*/*/*.ts", "*/*/*/*/*.ts", "*/*/*/*/*/*.ts", "*/*/*/*/*/*/*.ts", "*/*/*/*/*/*/*/*.ts"]

/** The absolute filename of a fixture-relative path. */
export const at = (rel) => join(TYPED_ROOT, rel)

/** A RuleTester with typed linting and the fixture HFS settings. */
export const typedTester = ({ declaration } = {}) => new RuleTester({
    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2022,
        sourceType: "module",
        parserOptions: {
            // A case's file need not exist: the default project types it with this directory's tsconfig.json.
            projectService: { allowDefaultProject: DEPTHS, defaultProject: "tsconfig.json" },
            tsconfigRootDir: TYPED_ROOT,
        },
    },
    settings: { starci: { hfs: fixtureHfs(declaration) } },
})
