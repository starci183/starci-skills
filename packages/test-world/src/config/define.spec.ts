import "reflect-metadata"
import assert from "node:assert/strict"
import test from "node:test"
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
    static register(_options: ApiOptions): DynamicModule {
        return { module: ApiApp }
    }
}

@Module({})
class OtherApp {
    static register(_options: { readonly peer: string }): DynamicModule {
        return { module: OtherApp }
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
    migrate: { module: async (_options: { readonly url: string }) => undefined, options: (w) => ({ url: w.db.audit.url }) },
})

test("defineTestWorld remembers the declaration for the globalSetup and answers the spec-facing functions", () => {
    assert.equal(typeof declared.useTestWorld, "function")
    assert.equal(typeof declared.useSandbox, "function")
    assert.equal(rememberedDeclaration()?.stack, ".starcistacks/dev")
})

test("the option builders receive a wiring typed by the declared names", () => {
    // compile-time proof: none of these lines may type-check
    const check = (): void => {
        defineTestWorld({
            stack: "x",
            stacks: { postgresql: { connections: [{ name: "primary" }] } },
            apps: {
                api: {
                    module: ApiApp,
                    // @ts-expect-error `nope` is not a declared connection
                    options: (w) => ({ port: 1, databaseUrl: w.db.nope.url, smtpHost: "" }),
                },
            },
            migrate: { module: async () => undefined, options: () => undefined },
        })
        defineTestWorld({
            stack: "x",
            stacks: {},
            apps: {
                // @ts-expect-error the options do not satisfy ApiOptions
                api: { module: ApiApp, options: () => ({ port: "one" }) },
            },
            migrate: { module: async () => undefined, options: () => undefined },
        })
    }
    assert.equal(typeof check, "function")
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
