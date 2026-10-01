import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { describe, test } from "node:test"
import * as ts from "typescript"
import { registerTsPaths, resolveTsPaths, stripJsonc } from "./paths"

/** A fresh fixture directory (real path, so the comparisons with TypeScript never differ by a symlink). */
const fixture = (): string => realpathSync(mkdtempSync(join(tmpdir(), "tw-paths-")))

/** Writes a file, creating its folders. */
const write = (path: string, content: string): void => {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
}

const json = (value: unknown): string => JSON.stringify(value, null, 2)

/** What TypeScript itself makes of a config: the directory the `paths` targets are relative to, and the mapping. */
const typescriptView = (file: string): { readonly base: string; readonly paths: unknown } => {
    const parsed = ts.getParsedCommandLineOfConfigFile(file, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined })
    assert.ok(parsed !== undefined, `typescript could not parse ${file}`)
    const options = parsed.options as ts.CompilerOptions & { readonly pathsBasePath?: string }
    const base = options.baseUrl ?? options.pathsBasePath
    assert.ok(typeof base === "string", "typescript resolved no base for paths")
    return { base: resolve(base), paths: options.paths }
}

/** Asserts the library resolves the aliases of `file` exactly as TypeScript does. */
const agreesWithTypescript = (file: string): void => {
    const library = resolveTsPaths(file)
    assert.ok(library !== null)
    const typescript = typescriptView(file)
    assert.equal(library.baseUrl, typescript.base)
    assert.deepEqual(library.paths, typescript.paths)
}

describe("tsconfig paths resolution", () => {
    test("a leaf that only extends the parent declaring paths resolves against the parent's folder", () => {
        const app = fixture()
        write(join(app, "be", "tsconfig.json"), json({ compilerOptions: { paths: { "@modules/*": ["./src/modules/*"] } } }))
        write(join(app, "be", "src", "tests", "tsconfig.json"), json({ extends: "../../tsconfig.json", include: ["./**/*.ts"] }))

        const resolved = resolveTsPaths(join(app, "be", "src", "tests", "tsconfig.json"))

        assert.deepEqual(resolved, { baseUrl: join(app, "be"), paths: { "@modules/*": ["./src/modules/*"] } })
        agreesWithTypescript(join(app, "be", "src", "tests", "tsconfig.json"))
    })

    test("a leaf whose own baseUrl overrides resolves the inherited paths against that baseUrl", () => {
        const app = fixture()
        write(join(app, "be", "tsconfig.json"), json({ compilerOptions: { paths: { "@modules/*": ["./modules/*"] } } }))
        write(join(app, "be", "src", "tests", "tsconfig.json"), json({ extends: "../../tsconfig.json", compilerOptions: { baseUrl: ".." } }))

        const resolved = resolveTsPaths(join(app, "be", "src", "tests", "tsconfig.json"))

        assert.deepEqual(resolved, { baseUrl: join(app, "be", "src"), paths: { "@modules/*": ["./modules/*"] } })
        agreesWithTypescript(join(app, "be", "src", "tests", "tsconfig.json"))
    })

    test("an array extends takes the paths of the later entry, including a package specifier", () => {
        const app = fixture()
        write(join(app, "node_modules", "@acme", "tsconfig", "package.json"), json({ name: "@acme/tsconfig", version: "1.0.0" }))
        write(join(app, "node_modules", "@acme", "tsconfig", "e2e.json"), json({ compilerOptions: { noEmit: true } }))
        write(join(app, "shared", "first.json"), json({ compilerOptions: { paths: { "@first/*": ["./first/*"] } } }))
        write(join(app, "be", "tsconfig.json"), json({ compilerOptions: { paths: { "@modules/*": ["./src/modules/*"] } } }))
        write(
            join(app, "be", "src", "tests", "tsconfig.json"),
            // A JSONC file, as TypeScript accepts it: comments and a trailing comma.
            `{\n  // the app config wins over the shared one\n  "extends": ["../../../shared/first.json", "../../tsconfig.json", "@acme/tsconfig/e2e.json"],\n  "include": ["./**/*.ts"],\n}\n`,
        )

        const resolved = resolveTsPaths(join(app, "be", "src", "tests", "tsconfig.json"))

        assert.deepEqual(resolved, { baseUrl: join(app, "be"), paths: { "@modules/*": ["./src/modules/*"] } })
        agreesWithTypescript(join(app, "be", "src", "tests", "tsconfig.json"))
    })

    test("a chain without paths answers null", () => {
        const app = fixture()
        write(join(app, "tsconfig.json"), json({ compilerOptions: { strict: true } }))

        assert.equal(resolveTsPaths(join(app, "tsconfig.json")), null)
    })

    test("comments and trailing commas are stripped outside strings only", () => {
        assert.equal(stripJsonc('{ "a": "x // y", /* c */ "b": [1, 2,], }'), '{ "a": "x // y",  "b": [1, 2] }')
    })

    test("the globalSetup resolution loads a declaration that imports an alias, as tsc resolves it", () => {
        const app = fixture()
        write(join(app, "be", "tsconfig.json"), json({ compilerOptions: { paths: { "@modules/*": ["./src/modules/*"] } } }))
        write(join(app, "be", "src", "tests", "tsconfig.json"), json({ extends: "../../tsconfig.json" }))
        write(join(app, "be", "src", "modules", "probe", "index.js"), 'module.exports = { probe: "resolved" }\n')
        write(join(app, "be", "src", "tests", "world", "declaration.js"), 'module.exports = require("@modules/probe")\n')
        agreesWithTypescript(join(app, "be", "src", "tests", "tsconfig.json"))

        const unregister = registerTsPaths(join(app, "be"))
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const loaded = require(join(app, "be", "src", "tests", "world", "declaration.js")) as { readonly probe: string }
            assert.equal(loaded.probe, "resolved")
        } finally {
            unregister()
        }
    })
})
