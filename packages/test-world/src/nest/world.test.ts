import "reflect-metadata"
import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { Controller, Get, Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import type { AnyTestWorldConfig } from "../config/types"
import { FakesHost } from "../fakes/framework/host"
import { STATE_FILE_ENV, writeRunContext, removeRunContext } from "../jest/context"
import type { RunContext } from "../jest/context"
import { World } from "./world"
import type { WorldSpec } from "./world-types"

interface ApiOptions {
    readonly greeting: string
    readonly workerUrl: string
}

@Controller()
class HelloController {
    static greeting = ""
    @Get("hello")
    hello(): { hello: string } {
        return { hello: HelloController.greeting }
    }
}

@Module({})
class ApiApp {
    static register(options: ApiOptions): DynamicModule {
        HelloController.greeting = options.greeting
        return { module: ApiApp, controllers: [HelloController] }
    }
}

@Module({})
class WorkerApp {
    static seen: string | null = null
    static register(options: { readonly peer: string }): DynamicModule {
        WorkerApp.seen = options.peer
        return { module: WorkerApp }
    }
}

const started: Array<() => Promise<void>> = []

const declaration = (order: Array<string>): AnyTestWorldConfig =>
    ({
        stack: ".starcistacks/dev",
        stacks: {},
        apps: {
            api: {
                module: ApiApp,
                options: (w: { apps: Record<string, { url: string }>; secret(label: string): string }) => {
                    order.push("api")
                    return { greeting: `hi-${w.secret("greeting").slice(0, 4)}`, workerUrl: w.apps["api"]?.url ?? "" }
                },
            },
            worker: {
                module: WorkerApp,
                listen: false,
                options: (w: { apps: Record<string, { url: string }> }) => {
                    order.push("worker")
                    return { peer: w.apps["api"]?.url ?? "no-api" }
                },
            },
        },
        migrate: { module: async () => undefined, options: () => undefined },
        identity: {
            signIn: async () => ({ personId: "p1", sessionToken: "s1" }),
        },
        logger: ["error"],
    }) as unknown as AnyTestWorldConfig

const publish = async (): Promise<RunContext> => {
    const fakes = new FakesHost({}, { runId: "t", secret: (label) => label, now: () => new Date() })
    const { controlUrl, fakes: entries } = await fakes.start()
    started.push(() => fakes.close())
    const context: RunContext = {
        version: 1,
        runId: "t",
        namespace: { snake: "t_000000", kebab: "t-000000", root: "/x" },
        secretSeed: "seed",
        infra: { toxiproxyApi: "http://127.0.0.1:1" },
        fakes: { controlUrl, entries },
        services: {},
        directories: { run: mkdtempSync(join(tmpdir(), "tw-world-")) },
        keepTables: {},
        root: "/x",
    }
    writeRunContext(context)
    return context
}

test.afterEach(async () => {
    removeRunContext()
    while (started.length > 0) await started.pop()?.()
})

test("apps boot in declared order, the api port is reserved before any options are built, and a worker has no api", async () => {
    await publish()
    const order: Array<string> = []
    const resets: Array<string> = []
    const world = new World(declaration(order), { apps: ["worker", "api"] } as WorldSpec, { resetRun: async (context) => void resets.push(context.runId) })
    await world.start()
    try {
        assert.deepEqual(order, ["api", "worker"])
        assert.deepEqual(resets, ["t"])
        const { api } = world.apps["api" as keyof typeof world.apps] as { api: { baseUrl: string; get<T>(path: string): Promise<{ status: number; body: T }> } }
        const hello = await api.get<{ hello: string }>("/hello")
        assert.equal(hello.status, 200)
        assert.match(hello.body.hello, /^hi-/)
        assert.equal(WorkerApp.seen, api.baseUrl)
        assert.throws(() => (world.apps["worker" as keyof typeof world.apps] as { api: unknown }).api, /has no listener/)
        assert.equal(process.env[STATE_FILE_ENV] !== undefined, true)
    } finally {
        await world.stop()
    }
})

test("an app the declaration lacks, or the spec did not boot, is a NotDeclared failure", async () => {
    await publish()
    const missing = new World(declaration([]), { apps: ["nope"] } as WorldSpec, { resetRun: async () => undefined })
    await assert.rejects(missing.start(), /TEST_WORLD_NOT_DECLARED.*apps.nope/)
    const world = new World(declaration([]), { apps: { worker: true } } as WorldSpec, { resetRun: async () => undefined })
    await world.start()
    try {
        assert.throws(() => (world.apps["api" as keyof typeof world.apps] as { name: string }).name, /apps.api/)
    } finally {
        await world.stop()
    }
})

test("using the world before it booted names the cause; waitFor and waitUntil poll state", async () => {
    await publish()
    const world = new World(declaration([]), { apps: ["api"] } as WorldSpec, { resetRun: async () => undefined })
    assert.throws(() => world.db, /TEST_WORLD_NOT_BOOTED/)
    await world.start()
    try {
        let counter = 0
        assert.equal(await world.waitFor("counter reaches 3", async () => (++counter === 3 ? counter : null), { intervalMs: 5 }), 3)
        assert.equal(await world.waitUntil("counter above 5", async () => ++counter, (value) => value > 5, { intervalMs: 5 }), 6)
        await assert.rejects(world.waitFor("never", async () => null, { timeoutMs: 40, intervalMs: 5 }), /waiting for never/)
    } finally {
        await world.stop()
    }
})

test("signedInPerson runs register then signIn of the declared identity and answers a caller of the first listening app", async () => {
    await publish()
    const calls: Array<string> = []
    const config = declaration([])
    const identity = {
        emailDomain: "shop.dev",
        register: async (_world: unknown, credentials: { email: string }) => void calls.push(`register ${credentials.email}`),
        signIn: async (_world: unknown, credentials: { email: string }) => {
            calls.push(`signIn ${credentials.email}`)
            return { personId: "p9", sessionToken: "tok9" }
        },
    }
    const world = new World({ ...config, identity } as unknown as AnyTestWorldConfig, { apps: ["api", "worker"] } as WorldSpec, { resetRun: async () => undefined })
    await world.start()
    try {
        const person = await world.signedInPerson("alice")
        assert.match(person.email, /^alice-.+@shop\.dev$/)
        assert.equal(person.personId, "p9")
        assert.equal(person.sessionToken, "tok9")
        assert.equal(calls.length, 2)
        assert.equal((await person.caller.get<{ hello: string }>("/hello")).status, 200)
        assert.equal((await world.signIn("bob@shop.dev", "pw")).sessionToken, "tok9")
        assert.equal(world.actAs(person) !== undefined, true)
    } finally {
        await world.stop()
    }
})

test("a modules world without a declared base is a NotDeclared failure", async () => {
    await publish()
    const world = new World(declaration([]), { modules: [] } as WorldSpec, { resetRun: async () => undefined })
    await assert.rejects(world.start(), /modules/)
})

test("buckets expose the run-isolated bucket with scoped credentials, and a run without minio says so", async () => {
    const context = await publish()
    const minioContext: RunContext = {
        ...context,
        infra: {
            toxiproxyApi: "http://127.0.0.1:1",
            minio: { host: "127.0.0.1", port: 30103, directPort: 55003, proxy: "p", image: "m", container: "c", accessKey: "ak", secretKey: "sk", bucketPrefix: "t-000000-", buckets: { authoring: "t-000000-authoring" } },
        },
    }
    removeRunContext()
    writeRunContext(minioContext)
    const world = new World(declaration([]), { apps: ["api"] } as WorldSpec, { resetRun: async () => undefined })
    await world.start()
    try {
        assert.deepEqual(world.buckets["authoring"], {
            endpoint: "http://127.0.0.1:30103",
            region: "us-east-1",
            bucket: "t-000000-authoring",
            accessKeyId: "ak",
            secretAccessKey: "sk",
            forcePathStyle: true,
        })
    } finally {
        await world.stop()
    }
    removeRunContext()
    writeRunContext(context)
    const plain = new World(declaration([]), { apps: ["api"] } as WorldSpec, { resetRun: async () => undefined })
    await plain.start()
    try {
        assert.throws(() => plain.buckets, /stacks.minio/)
    } finally {
        await plain.stop()
    }
})

test("applicationOrigin answers scheme://host:port of the named or first listening app, and restart boots the app again on the same port with the same builders", async () => {
    await publish()
    const order: Array<string> = []
    const world = new World(declaration(order), { apps: ["api", "worker"] } as WorldSpec, { resetRun: async () => undefined })
    await world.start()
    try {
        const handle = world.apps["api" as keyof typeof world.apps] as { api: { baseUrl: string; get<T>(p: string): Promise<{ status: number }> }; restart(): Promise<void> }
        const before = handle.api.baseUrl
        assert.equal(world.applicationOrigin(), before)
        assert.equal(world.applicationOrigin("api"), before)
        assert.throws(() => world.applicationOrigin("worker"), /worker/)
        await handle.restart()
        assert.deepEqual(order, ["api", "worker", "api"])
        const after = world.apps["api" as keyof typeof world.apps] as { api: { baseUrl: string; get<T>(p: string): Promise<{ status: number }> } }
        assert.equal(after.api.baseUrl, before)
        assert.equal((await after.api.get("/hello")).status, 200)
        await assert.rejects(world.restartApp("nope"), /apps.nope/)
    } finally {
        await world.stop()
    }
})

test("withRequest runs commands, queries and providers in a real request scope that carries the request values", async () => {
    await publish()
    const { CommandBus, CommandHandler, CqrsModule, QueryBus, QueryHandler } = await import("@nestjs/cqrs")
    const { Inject, Injectable, Scope } = await import("@nestjs/common")
    const { REQUEST } = await import("@nestjs/core")

    class WhoAmI {}
    class WhichPlan {}
    @Injectable({ scope: Scope.REQUEST })
    class Acting {
        constructor(@Inject(REQUEST) readonly request: { principal?: string; locale?: string; plan?: string }) {}
    }
    @CommandHandler(WhoAmI, { scope: Scope.REQUEST })
    class WhoAmIHandler {
        constructor(@Inject(REQUEST) private readonly request: { principal?: string; locale?: string }) {}
        async execute(): Promise<string> {
            return `${this.request.principal}/${this.request.locale}`
        }
    }
    @QueryHandler(WhichPlan)
    class WhichPlanHandler {
        constructor(private readonly acting: Acting) {}
        async execute(): Promise<string | undefined> {
            return this.acting.request.plan
        }
    }
    @Module({ imports: [CqrsModule.forRoot()], providers: [Acting, WhoAmIHandler, WhichPlanHandler] })
    class Capability {}

    const config = {
        ...declaration([]),
        modules: { base: () => [] },
    } as unknown as AnyTestWorldConfig
    const world = new World(config, { modules: [() => ({ module: Capability })] } as WorldSpec, { resetRun: async () => undefined })
    await world.start()
    try {
        assert.equal(world.commandBus !== undefined && world.queryBus !== undefined, true)
        const first = await world.withRequest({ principal: "learner-1", locale: "vi", plan: "pro" }, async (scope) => ({
            who: await scope.commandBus.execute(new WhoAmI()),
            plan: await scope.queryBus.execute(new WhichPlan()),
            acting: (await scope.resolve(Acting)).request.principal,
        }))
        assert.deepEqual(first, { who: "learner-1/vi", plan: "pro", acting: "learner-1" })
        const second = await world.withRequest({ principal: "learner-2", locale: "en" }, (scope) => scope.commandBus.execute(new WhoAmI()))
        assert.equal(second, "learner-2/en")
        assert.equal(CommandBus !== undefined && QueryBus !== undefined, true)
    } finally {
        await world.stop()
    }
})

/** A toxiproxy API that records every call and answers what the client expects. */
const fakeToxiproxy = async (): Promise<{ readonly url: string; readonly calls: Array<string> }> => {
    const calls: Array<string> = []
    const server = createServer((request, response) => {
        calls.push(`${request.method} ${request.url}`)
        request.resume()
        request.on("end", () => {
            response.writeHead(200, { "content-type": "application/json" })
            response.end(request.method === "GET" ? "[]" : "{}")
        })
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    started.push(() => new Promise<void>((resolve) => server.close(() => resolve())))
    return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, calls }
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 80))

test("an outage takes the run's outage lock itself: it waits for another file's running test, holds that file's next test until restore, and only its own world restores it", async () => {
    const context = await publish()
    const toxiproxy = await fakeToxiproxy()
    const outageContext = {
        ...context,
        infra: { toxiproxyApi: toxiproxy.url, postgresql: { host: "127.0.0.1", port: 1, directPort: 2, proxy: "pg", image: "postgres", container: "c", user: "u", password: "p", databases: {} } },
    } as RunContext
    removeRunContext()
    writeRunContext(outageContext)
    const options = { resetRun: async () => undefined, lockIntervalMs: 5 }
    const outage = new World(declaration([]), { apps: ["worker"] } as WorldSpec, options)
    const other = new World(declaration([]), { apps: ["worker"] } as WorldSpec, options)
    await outage.start()
    await other.start()
    try {
        await other.enterTest()
        let cut = false
        const cutting = outage.infra.postgresql.cut().then(() => {
            cut = true
        })
        await settle()
        assert.equal(cut, false, "the outage waits for the other file's running test")
        assert.equal(toxiproxy.calls.length, 0, "nothing reached toxiproxy while the other test ran")
        other.leaveTest()
        await cutting
        assert.equal(toxiproxy.calls.some((call) => call === "POST /proxies/pg"), true)
        let entered = false
        const entering = other.enterTest().then(() => {
            entered = true
        })
        await settle()
        assert.equal(entered, false, "the other file's next test waits while postgres is cut")
        const before = toxiproxy.calls.length
        await outage.infra.postgresql.restore()
        await entering
        assert.equal(toxiproxy.calls.length > before, true)
        other.leaveTest()
        const calls = toxiproxy.calls.length
        await other.stop()
        assert.equal(toxiproxy.calls.length, calls, "a world without an outage of its own restores nothing at stop")
        await outage.infra.postgresql.during(async () => {
            assert.equal(toxiproxy.calls.at(-1), "POST /proxies/pg")
        })
    } finally {
        await other.stop()
        await outage.stop()
    }
})

test("one connection's database outage takes the outage lock like any outage, touches only that database, and a world that stops with it down restores it", async () => {
    const context = await publish()
    const queries: Array<string> = []
    const pgConnect = () => ({
        connect: async () => undefined,
        query: async (text: string) => {
            queries.push(text)
            return { rows: [] }
        },
        end: async () => undefined,
        on: () => undefined,
    })
    const outageContext = {
        ...context,
        infra: {
            toxiproxyApi: "http://127.0.0.1:1",
            postgresql: { host: "127.0.0.1", port: 1, directPort: 2, proxy: "pg", image: "postgres", container: "c", user: "u", password: "p", databases: { identity: "t_identity", order: "t_order" } },
        },
    } as RunContext
    removeRunContext()
    writeRunContext(outageContext)
    const options = { resetRun: async () => undefined, lockIntervalMs: 5, pgConnect }
    const outage = new World(declaration([]), { apps: ["worker"] } as WorldSpec, options)
    const other = new World(declaration([]), { apps: ["worker"] } as WorldSpec, options)
    await outage.start()
    await other.start()
    try {
        await other.enterTest()
        let cut = false
        const cutting = outage.infra.postgresql
            .connection("order")
            .cut()
            .then(() => {
                cut = true
            })
        await settle()
        assert.equal(cut, false, "the database outage waits for the other file's running test")
        assert.equal(queries.length, 0)
        other.leaveTest()
        await cutting
        assert.deepEqual(
            queries.filter((query) => query.startsWith("ALTER")),
            [`ALTER DATABASE "t_order" ALLOW_CONNECTIONS false`],
        )
        let entered = false
        const entering = other.enterTest().then(() => {
            entered = true
        })
        await settle()
        assert.equal(entered, false, "the other file's next test waits while the order database is down")
        await outage.infra.postgresql.connection("order").restore()
        await entering
        other.leaveTest()
        assert.equal(queries.at(-1), `ALTER DATABASE "t_order" ALLOW_CONNECTIONS true`)
        assert.throws(() => outage.infra.postgresql.connection("billing"), /connection\(billing\) is not a declared connection/)
        await outage.interruptDatabase(async () => {
            assert.equal(queries.at(-1)?.includes("pg_terminate_backend"), true)
        }, "identity")
        assert.equal(queries.at(-1), `ALTER DATABASE "t_identity" ALLOW_CONNECTIONS true`)
        await outage.infra.postgresql.connection("identity").cut()
        queries.length = 0
        await outage.stop()
        assert.deepEqual(queries, [`ALTER DATABASE "t_identity" ALLOW_CONNECTIONS true`], "a database left down is restored at stop")
    } finally {
        await other.stop()
        await outage.stop()
    }
})

test("a client-secret rotation takes the outage lock too and, never undone, holds it until its world stops", async () => {
    const context = await publish()
    const server = createServer((request, response) => {
        request.resume()
        request.on("end", () => {
            const url = request.url ?? ""
            const body = url.includes("/protocol/openid-connect/token") ? { access_token: "admin" } : url.includes("?clientId=") ? [{ id: "c1" }] : { value: "rotated" }
            response.writeHead(200, { "content-type": "application/json" })
            response.end(JSON.stringify(body))
        })
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    started.push(() => new Promise<void>((resolve) => server.close(() => resolve())))
    const port = (server.address() as AddressInfo).port
    const keycloakContext = {
        ...context,
        infra: { toxiproxyApi: "http://127.0.0.1:1", keycloak: { host: "127.0.0.1", port, directPort: port, proxy: "kc", image: "keycloak", container: "c", realm: "t-realm", clientId: "api", adminUser: "a", adminPassword: "p" } },
    } as RunContext
    removeRunContext()
    writeRunContext(keycloakContext)
    const options = { resetRun: async () => undefined, lockIntervalMs: 5 }
    const rotating = new World(declaration([]), { apps: ["worker"] } as WorldSpec, options)
    const other = new World(declaration([]), { apps: ["worker"] } as WorldSpec, options)
    await rotating.start()
    await other.start()
    try {
        await other.enterTest()
        let secret: string | null = null
        const rotation = rotating.infra.keycloak.rotateClientSecret("api").then((value) => {
            secret = value
        })
        await settle()
        assert.equal(secret, null, "the rotation waits for the other file's running test")
        other.leaveTest()
        await rotation
        assert.equal(secret, "rotated")
        let entered = false
        const entering = other.enterTest().then(() => {
            entered = true
        })
        await settle()
        assert.equal(entered, false, "the realm stays changed, so the other file waits until the rotating world stops")
        await rotating.stop()
        await entering
        assert.equal(entered, true)
        other.leaveTest()
    } finally {
        await other.stop()
        await rotating.stop()
    }
})
