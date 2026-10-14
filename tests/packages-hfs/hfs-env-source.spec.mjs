import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import vm from "node:vm"
import { randomBytes } from "node:crypto"
import { createRequire } from "node:module"

const ROOT = path.resolve(import.meta.dirname, "..", "..")
const ts = createRequire(import.meta.url)("typescript")
const SOURCES = [
    ["scaffold", "packages/hfs/templates/be/skeleton/src/modules/platform/config/env-source.config.ts"],
    ...["ecommerce-app", "lite-app", "shape-slot"].map((app) => [app, `examples/${app}/be/src/modules/platform/config/env-source.config.ts`]),
]

/** Execute the real EnvSource with an isolated process object, never the test runner's environment. */
function loadEnvSource(relative, values) {
    let reads = 0
    const process = { get env() { reads += 1; return values } }
    class ConfigError extends Error {
        constructor({ code, params }) { super(code); this.code = code; this.params = params }
    }
    const modules = {
        "node:fs": fs,
        "./errors/config.error": { ConfigError, ConfigErrorCode: { KeyMissing: "CONFIG_KEY_MISSING", KeyInvalid: "CONFIG_KEY_INVALID" } },
    }
    const compiled = ts.transpileModule(fs.readFileSync(path.join(ROOT, relative), "utf8"), {
        fileName: relative,
        reportDiagnostics: true,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    })
    assert.equal(compiled.diagnostics.length, 0, "EnvSource has valid TypeScript syntax")
    const module = { exports: {} }
    const require = (name) => {
        if (!(name in modules)) throw new Error("EnvSource imports an unexpected module")
        return modules[name]
    }
    vm.runInNewContext(compiled.outputText, { module, exports: module.exports, require, process, URL }, { filename: relative })
    return { EnvSource: module.exports.EnvSource, reads: () => reads }
}

for (const [label, relative] of SOURCES) {
    test(`${label}: NAME_FILE takes priority, preserves exact contents, and is read once at boot`, (t) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hfs-env-source-"))
        t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
        const file = path.join(dir, "TEST_API_KEY")
        const fileValue = ` ${randomBytes(20).toString("hex")}\r\n`
        const values = { TEST_API_KEY: randomBytes(20).toString("hex"), TEST_API_KEY_FILE: file }
        fs.writeFileSync(file, fileValue, { mode: 0o600 })
        const { EnvSource, reads } = loadEnvSource(relative, values)
        const env = EnvSource.fromProcess()
        assert.ok(env.secret("TEST_API_KEY").reveal() === fileValue, "the exact file contents override the direct value")
        assert.equal(reads(), 1, "bootstrap takes one process environment snapshot")
        assert.equal(JSON.stringify(env.secret("TEST_API_KEY")), '"[secret]"', "serialization masks the secret")
        values.TEST_API_KEY = randomBytes(20).toString("hex")
        fs.writeFileSync(file, randomBytes(20).toString("hex"))
        assert.ok(env.secret("TEST_API_KEY").reveal() === fileValue, "typed readers use the bootstrap snapshot")
        assert.equal(reads(), 1, "typed readers do not read process state again")
    })

    test(`${label}: NAME supplies the value when NAME_FILE is absent`, () => {
        const direct = randomBytes(20).toString("hex")
        const { EnvSource } = loadEnvSource(relative, { TEST_API_KEY: direct, TEST_API_KEY_FILE: undefined })
        assert.ok(EnvSource.fromProcess().secret("TEST_API_KEY").reveal() === direct, "the direct value is used without a file declaration")
    })

    test(`${label}: an unreadable or empty NAME_FILE never falls back to NAME`, (t) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hfs-env-source-"))
        t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
        for (const file of [path.join(dir, "absent"), ""]) {
            const { EnvSource } = loadEnvSource(relative, { TEST_API_KEY: randomBytes(20).toString("hex"), TEST_API_KEY_FILE: file })
            assert.throws(() => EnvSource.fromProcess(), "an invalid file declaration fails boot")
        }
        const empty = path.join(dir, "empty")
        fs.writeFileSync(empty, "")
        const { EnvSource } = loadEnvSource(relative, { TEST_API_KEY: randomBytes(20).toString("hex"), TEST_API_KEY_FILE: empty })
        assert.throws(() => EnvSource.fromProcess().secret("TEST_API_KEY"), (error) => error.code === "CONFIG_KEY_MISSING", "empty file contents do not admit the direct value")
    })
}
