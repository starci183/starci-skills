import "reflect-metadata"
import assert from "node:assert/strict"
import { dirname, join, sep } from "node:path"
import test from "node:test"
import * as ts from "typescript"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { smtpFake } from "../fakes/shared/smtp"
import { rememberedDeclaration } from "./registry"
import { defineTestWorld } from "./define"

interface ApiOptions {
    readonly port: number
    readonly databaseUrl: string
    readonly smtpHost: string
}

@Module({})
class ApiApp {
    static register(options: ApiOptions): DynamicModule {
        return { module: ApiApp, providers: [{ provide: "API_OPTIONS", useValue: options }] }
    }
}

@Module({})
class OtherApp {
    static register(options: { readonly peer: string }): DynamicModule {
        return { module: OtherApp, providers: [{ provide: "OTHER_OPTIONS", useValue: options }] }
    }
}

const declared = defineTestWorld({
    stack: ".starcistacks/dev",
    stacks: { postgresql: { connections: [{ name: "primary" }, { name: "audit" }] }, redis: {}, vllm: { fakedBy: "mail", reason: "needs a gpu" } },
    fakes: { mail: smtpFake() },
    apps: {
        api: {
            module: ApiApp,
            // the wiring is typed by the declaration: connection, fake and app names are literals, options are ApiOptions
            options: (w) => ({ port: w.apps.api.port, databaseUrl: w.db.primary.url + w.db.audit.url, smtpHost: w.fake.mail.host }),
        },
        other: {
            module: OtherApp,
            listen: false,
            options: (w) => ({ peer: w.apps.api.url }),
        },
    },
    migrate: { module: async (options: { readonly url: string }) => void assert.equal(typeof options.url, "string"), options: (w) => ({ url: w.db.audit.url }) },
})

test("defineTestWorld remembers the declaration for the globalSetup and answers the spec-facing functions", () => {
    assert.equal(typeof declared.useTestWorld, "function")
    assert.equal(typeof declared.useSandbox, "function")
    assert.equal(rememberedDeclaration()?.stack, ".starcistacks/dev")
})

/**
 * Compiles `source` as a file beside the compiled `define` (so `./define` resolves to its declarations) with the
 * package's own compiler options, the way `tsc` checks an app. Answers the diagnostics as `{ line, code, text }`: a type
 * test asserts the error the compiler reports, so no directive in a fixture hides one.
 */
const compile = (source: string): ReadonlyArray<{ readonly line: number; readonly code: number; readonly text: string }> => {
    const configFile = join(__dirname, "..", "..", "tsconfig.json")
    const read = ts.readConfigFile(configFile, ts.sys.readFile)
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configFile))
    // The probe is compiled in memory: no output root and no output directory (left out, not set to undefined: exactOptionalPropertyTypes).
    const options: ts.CompilerOptions = { ...parsed.options, noEmit: true, declaration: false }
    delete options.rootDir
    delete options.outDir
    const file = join(__dirname, "type-probe.ts").split(sep).join("/")
    const host = ts.createCompilerHost(options)
    const readSource = host.getSourceFile.bind(host)
    host.getSourceFile = (name, languageVersion, ...rest) => (name === file ? ts.createSourceFile(name, source, languageVersion) : readSource(name, languageVersion, ...rest))
    const fileExists = host.fileExists.bind(host)
    host.fileExists = (name) => name === file || fileExists(name)
    const program = ts.createProgram([file], options, host)
    return ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
        line: diagnostic.file === undefined || diagnostic.start === undefined ? 0 : diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1,
        code: diagnostic.code,
        text: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    }))
}

const PROBE_HEADER = `import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { defineTestWorld } from "./define"
interface ApiOptions { readonly port: number; readonly databaseUrl: string; readonly smtpHost: string }
@Module({})
class ApiApp { static register(options: ApiOptions): DynamicModule { return { module: ApiApp, providers: [{ provide: "OPTIONS", useValue: options }] } } }
`

/** A declaration whose one app's options are `options`. */
const probeDeclaration = (options: string): string => `${PROBE_HEADER}defineTestWorld({
    stack: "x",
    stacks: { postgresql: { connections: [{ name: "primary" }] } },
    apps: { api: { module: ApiApp, options: ${options} } },
    migrate: { module: async () => undefined, options: () => undefined },
})
`

const lineOf = (source: string, marker: string): number => source.split("\n").findIndex((line) => line.includes(marker)) + 1

/** TS2339 (the property does not exist on the type) and TS2322 (the value is not assignable to the type). */
const NO_SUCH_MEMBER = 2339
const NOT_ASSIGNABLE = 2322

test("the option builders receive a wiring typed by the declared names: a valid declaration compiles", () => {
    assert.deepEqual(compile(probeDeclaration("(w) => ({ port: 1, databaseUrl: w.db.primary.url, smtpHost: \"\" })")), [])
})

test("the option builders reject a connection that is not declared, as the compiler reports it", () => {
    const source = probeDeclaration("(w) => ({ port: 1, databaseUrl: w.db.nope.url, smtpHost: \"\" })")
    assert.deepEqual(compile(source).map(({ line, code }) => ({ line, code })), [{ line: lineOf(source, "w.db.nope"), code: NO_SUCH_MEMBER }])
})

test("the option builders reject options that do not satisfy the app's ApiOptions, as the compiler reports it", () => {
    const source = probeDeclaration("() => ({ port: \"one\" })")
    const problems = compile(source)
    assert.ok(problems.length > 0 && problems.every((problem) => problem.code === NOT_ASSIGNABLE), problems.map((problem) => problem.text).join("; "))
    assert.ok(problems.every((problem) => problem.line === lineOf(source, "port: \"one\"")))
})

test("useTestWorld registers the boot, a shared outage-lock hold around every test, and the stop, so no spec can skip the lock", async () => {
    const hooks = globalThis as unknown as Record<string, unknown>
    const names = ["jest", "beforeAll", "beforeEach", "afterEach", "afterAll"] as const
    const saved = names.map((name) => [name, hooks[name]] as const)
    const registered: Array<{ readonly hook: string; readonly run: () => unknown }> = []
    hooks["jest"] = { setTimeout: () => undefined }
    for (const hook of names.slice(1)) hooks[hook] = (run: () => unknown) => void registered.push({ hook, run })
    try {
        declared.useTestWorld({ apps: ["api"] })
        assert.deepEqual(
            registered.map((entry) => entry.hook),
            ["beforeAll", "beforeEach", "afterEach", "afterAll"],
        )
        // the per-test hold belongs to a booted world: before the boot it names the cause instead of running unlocked
        const enter = registered.find((entry) => entry.hook === "beforeEach")
        await assert.rejects(async () => enter?.run(), /has not booted yet/)
    } finally {
        for (const [name, value] of saved) hooks[name] = value
    }
})
