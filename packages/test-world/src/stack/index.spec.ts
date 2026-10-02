import { tmpdir } from "node:os"
import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync } from "node:fs"
import { join } from "node:path"
import { describe, it } from "node:test"
import { TestWorldErrorCode } from "../errors"
import type { AttachRequest, Namespace } from "./contracts"
import { Docker } from "./docker"
import type { ExecResult } from "./exec"
import type { PgClient } from "./pg"
import { createStack } from "./index"
import { KAFKA_IMAGE, containerName, kafkaProxyName, serviceContainerName } from "./naming"

const scratch = mkdtempSync(join(tmpdir(), "starci-tw-stack-"))
let counter = 0

/** A scripted docker: containers, published ports and the calls made. */
const fakeDocker = () => {
    const containers = new Map<string, { running: boolean; ports: Map<number, number> }>()
    const calls: Array<string> = []
    let nextPort = 40000
    const ok = (stdout = ""): ExecResult => ({ code: 0, stdout, stderr: "" })
    const exec = async (_command: string, args: ReadonlyArray<string>): Promise<ExecResult> => {
        calls.push(args.join(" "))
        const [verb] = args
        if (verb === "network") return ok()
        if (verb === "inspect") return containers.has(args[args.length - 1] ?? "") ? ok(containers.get(args[args.length - 1] ?? "")?.running ? "running" : "exited") : { code: 1, stdout: "", stderr: "no such" }
        if (verb === "run") {
            const name = args[args.indexOf("--name") + 1] ?? ""
            const ports = new Map<number, number>()
            args.forEach((arg, index) => {
                const match = /^127\.0\.0\.1::(\d+)$/.exec(arg)
                if (args[index - 1] === "-p" && match?.[1] !== undefined) ports.set(Number(match[1]), (nextPort += 1))
            })
            containers.set(name, { running: true, ports })
            return ok("id")
        }
        if (verb === "port") {
            const port = containers.get(args[1] ?? "")?.ports.get(Number((args[2] ?? "").split("/")[0]))
            return port === undefined ? { code: 1, stdout: "", stderr: "" } : ok(`127.0.0.1:${port}`)
        }
        if (verb === "start") {
            const found = containers.get(args[1] ?? "")
            if (found !== undefined) found.running = true
            return ok()
        }
        if (verb === "rm") {
            containers.delete(args[args.length - 1] ?? "")
            return ok()
        }
        if (verb === "ps") {
            return ok(
                [...containers.keys()]
                    .map((name) => `${name}|${containers.get(name)?.running ? "running" : "exited"}|${name.split("-")[2] ?? ""}|image`)
                    .join("\n"),
            )
        }
        return ok()
    }
    return { docker: new Docker(exec), containers, calls, runCount: () => calls.filter((call) => call.startsWith("run ")).length }
}

const fakeFetch = (log: Array<string>) =>
    (async (url: string | URL | Request, init?: RequestInit) => {
        const path = new URL(String(url)).pathname
        log.push(`${init?.method ?? "GET"} ${path}`)
        if (path === "/version") return new Response('"2.9.0"', { status: 200 })
        if (path === "/proxies" && (init?.method ?? "GET") === "GET") return new Response("{}", { status: 200 })
        if (path.endsWith("/toxics") && (init?.method ?? "GET") === "GET") return new Response("[]", { status: 200 })
        if (/^\/proxies\/[^/]+$/.test(path) && init?.method === "POST") return new Response("{}", { status: 200 })
        if (path === "/proxies") return new Response("{}", { status: 201 })
        return new Response(null, { status: 204 })
    }) as typeof fetch

const fakePg = (queries: Array<string>) => (): PgClient => ({
    connect: async () => undefined,
    on: () => undefined,
    end: async () => undefined,
    query: async (sql: string) => {
        queries.push(sql)
        return { rows: [{ "?column?": 1 }] }
    },
})

const namespace = (snake: string): Namespace => ({ snake, kebab: snake.replace(/_/g, "-"), root: `/repo/${snake}` })

const harness = (probed: Array<number> = [], process: { readonly home?: string; readonly pid?: number; readonly isAlive?: (pid: number) => boolean; readonly docker?: ReturnType<typeof fakeDocker> } = {}) => {
    const docker = process.docker ?? fakeDocker()
    const http: Array<string> = []
    const queries: Array<string> = []
    const redisCalls: Array<string> = []
    const stack = createStack({
        docker: docker.docker,
        home: process.home ?? join(scratch, `home${(counter += 1)}`),
        pause: async () => undefined,
        fetch: fakeFetch(http),
        pg: fakePg(queries),
        redis: async (_host, _port, commands) => {
            redisCalls.push(commands.map((command) => command.join(" ")).join(" | "))
            return commands.map((command) => (command[0] === "PING" ? "PONG" : "OK"))
        },
        cluster: {
            up: async () => undefined,
            attach: async () => {
                throw new Error("the fake cluster is not used")
            },
            reset: async () => undefined,
            detach: async () => undefined,
            status: async () => [],
            down: async () => undefined,
        },
        isAlive: process.isAlive ?? (() => true),
        pid: process.pid ?? 4321,
        kafkaProbe: async (_host, port) => {
            probed.push(port)
            return true
        },
    })
    return { docker, http, queries, redisCalls, stack }
}

const request = (ns: Namespace, runId: string): AttachRequest => ({
    namespace: ns,
    runId,
    services: [
        { service: "postgresql", image: "pgvector/pgvector:pg16" },
        { service: "redis", image: "redis:7-alpine" },
    ],
    postgresql: { connections: [{ name: "primary" }] },
})

describe("stack attach", () => {
    it("starts the shared containers keyed by image and answers proxied endpoints", async () => {
        const { docker, stack, http } = harness()
        const infra = await stack.attach(request(namespace("shop_aaaaaa"), "run1"))
        assert.deepEqual(
            [...docker.containers.keys()].sort(),
            [containerName("postgresql", "pgvector/pgvector:pg16"), containerName("redis", "redis:7-alpine"), containerName("toxiproxy", "ghcr.io/shopify/toxiproxy:2.9.0")].sort(),
        )
        assert.equal(infra.postgresql?.host, "127.0.0.1")
        assert.equal(infra.postgresql?.proxy, "run1-postgresql")
        assert.equal(infra.postgresql?.port, 30100)
        assert.equal(infra.redis?.port, 30101)
        assert.notEqual(infra.postgresql?.directPort, infra.postgresql?.port)
        assert.deepEqual(infra.postgresql?.databases, { primary: "shop_aaaaaa_primary" })
        assert.equal(infra.redis?.db, 0)
        assert.match(infra.toxiproxyApi, /^http:\/\/127\.0\.0\.1:\d+$/)
        assert.equal(http.filter((call) => call === "POST /proxies").length, 2)
        const run = docker.calls.find((call) => call.startsWith("run ") && call.includes("starci-ts-postgresql"))
        assert.ok(run?.includes("--restart no"))
        assert.ok(run?.includes("--network starci-test-net"))
        assert.ok(run?.includes("--label starci.test-stack=1"))
        assert.ok(run?.includes("-p 127.0.0.1::5432"))
    })

    it("a second attach of another repo starts nothing and gets its own databases, redis db and proxy ports", async () => {
        const { docker, stack, queries } = harness()
        await stack.attach(request(namespace("shop_aaaaaa"), "run1"))
        const runsAfterFirst = docker.runCount()
        const second = await stack.attach(request(namespace("blog_bbbbbb"), "run2"))
        assert.equal(docker.runCount(), runsAfterFirst)
        assert.equal(second.redis?.db, 1)
        assert.equal(second.postgresql?.port, 30102)
        assert.deepEqual(second.postgresql?.databases, { primary: "blog_bbbbbb_primary" })
        assert.ok(queries.includes('CREATE DATABASE "blog_bbbbbb_primary"'))
    })

    it("refuses a second live run of the same namespace with NamespaceBusy", async () => {
        const { stack } = harness()
        await stack.attach(request(namespace("shop_aaaaaa"), "run1"))
        await assert.rejects(stack.attach(request(namespace("shop_aaaaaa"), "run2")), (error: unknown) => error instanceof Error && "code" in error && error.code === TestWorldErrorCode.NamespaceBusy)
    })

    it("detach drops what the run owns, frees its leases, and lets the namespace attach again", async () => {
        const { stack, queries, redisCalls, http } = harness()
        const ns = namespace("shop_aaaaaa")
        const infra = await stack.attach(request(ns, "run1"))
        await stack.detach({ namespace: ns, runId: "run1", infra })
        assert.ok(queries.includes('DROP DATABASE IF EXISTS "shop_aaaaaa_primary" WITH (FORCE)'))
        assert.ok(redisCalls.includes("SELECT 0 | FLUSHDB"))
        assert.ok(http.includes("DELETE /proxies/run1-postgresql"))
        assert.equal((await stack.status()).leases.length, 0)
        const again = await stack.attach(request(ns, "run3"))
        assert.equal(again.redis?.db, 0)
        assert.equal(again.postgresql?.port, 30100)
    })

    it("kafka: one broker of the pinned image with a proxy per slot listener; each slot leases its own listener, probed through its proxy", async () => {
        const probed: Array<number> = []
        const { docker, stack, http } = harness(probed)
        const kafkaRequest = (ns: Namespace, runId: string): AttachRequest => ({ namespace: ns, runId, services: [{ service: "kafka", image: KAFKA_IMAGE }], kafka: { topics: ["orders"] } })
        const one = namespace("shop_aaaaaa_w1")
        const two = namespace("shop_aaaaaa_w2")
        const first = await stack.attach(kafkaRequest(one, "run1-w1"))
        assert.equal(http.filter((call) => call === "POST /proxies").length, 8, "one proxy per slot listener")
        const second = await stack.attach(kafkaRequest(two, "run1-w2"))
        assert.ok(docker.containers.has(serviceContainerName("kafka", KAFKA_IMAGE)))
        assert.notEqual(serviceContainerName("kafka", KAFKA_IMAGE), containerName("kafka", KAFKA_IMAGE), "a broker of another listener shape is another container")
        assert.equal(docker.runCount(), 2, "toxiproxy and one broker")
        assert.equal(first.kafka?.listener, 1)
        assert.equal(second.kafka?.listener, 2)
        assert.equal(first.kafka?.proxy, kafkaProxyName(KAFKA_IMAGE, 1))
        assert.equal(second.kafka?.proxy, kafkaProxyName(KAFKA_IMAGE, 2))
        assert.notEqual(first.kafka?.port, second.kafka?.port)
        assert.deepEqual(probed, [first.kafka?.port, second.kafka?.port])
        assert.equal(first.kafka?.groupPrefix, "shop-aaaaaa-w1.")
        const broker = docker.calls.find((call) => call.startsWith("run ") && call.includes("starci-ts-kafka"))
        assert.ok(broker?.includes(`S1://127.0.0.1:${first.kafka?.port}`), broker)
        assert.ok(broker?.includes(`S2://127.0.0.1:${second.kafka?.port}`), broker)
        await stack.detach({ namespace: one, runId: "run1-w1", infra: first })
        assert.equal(http.some((call) => call.startsWith("DELETE /proxies/kafka-")), false, "listener proxies belong to the broker")
        const again = await stack.attach(kafkaRequest(namespace("blog_bbbbbb_w1"), "run2-w1"))
        assert.equal(again.kafka?.listener, 1, "the freed listener is leased again")
        assert.equal(again.kafka?.port, first.kafka?.port)
    })

    it("a run whose process died is reclaimed by the next attach through the same teardown, and its namespace is free again", async () => {
        const home = join(scratch, `home${(counter += 1)}`)
        const docker = fakeDocker()
        const dead = new Set<number>()
        const crashed = harness([], { home, pid: 1111, isAlive: (pid) => !dead.has(pid), docker })
        const ns = namespace("shop_aaaaaa_w1")
        await crashed.stack.attach(request(ns, "crashed-w1"))
        dead.add(1111) // the jest process died: no detach ran
        const next = harness([], { home, pid: 2222, isAlive: (pid) => !dead.has(pid), docker })
        await next.stack.attach(request(namespace("blog_bbbbbb_w1"), "next-w1"))
        assert.ok(next.queries.includes('DROP DATABASE IF EXISTS "shop_aaaaaa_w1_primary" WITH (FORCE)'), "the crashed run's database is dropped")
        assert.ok(next.redisCalls.includes("SELECT 0 | FLUSHDB"), "its redis db is flushed")
        assert.ok(next.http.includes("DELETE /proxies/crashed-w1-postgresql"), "its proxies are removed")
        const leases = (await next.stack.status()).leases.map((lease) => lease.runId)
        assert.deepEqual(leases, ["next-w1"])
        const again = await next.stack.attach(request(ns, "rerun-w1"))
        assert.deepEqual(again.postgresql?.databases, { primary: "shop_aaaaaa_w1_primary" }, "the namespace attaches again")
    })

    it("a dead run that provisioned nothing is dropped without a teardown", async () => {
        const home = join(scratch, `home${(counter += 1)}`)
        const docker = fakeDocker()
        const dead = new Set<number>([3333])
        const live = harness([], { home, pid: 4444, isAlive: (pid) => !dead.has(pid), docker })
        const { Registry } = await import("./registry")
        await new Registry({ dir: home }).update((data) => void data.leases.push({ namespace: "ghost_w1", runId: "ghost", pid: 3333, since: "2026-01-01T00:00:00.000Z", containers: [] }))
        await live.stack.attach(request(namespace("shop_aaaaaa_w1"), "live-w1"))
        assert.equal(live.queries.some((query) => query.includes("ghost")), false)
        assert.deepEqual((await live.stack.status()).leases.map((lease) => lease.runId), ["live-w1"])
    })

    it("reset empties the namespace's databases and redis db", async () => {
        const { stack, queries, redisCalls } = harness()
        const ns = namespace("shop_aaaaaa")
        const infra = await stack.attach(request(ns, "run1"))
        await stack.reset({ namespace: ns, infra, keepTables: {} })
        assert.ok(queries.includes("SET session_replication_role = replica"))
        assert.ok(redisCalls.filter((call) => call === "SELECT 0 | FLUSHDB").length >= 2)
    })

    it("down keeps containers a live lease uses and removes everything with force", async () => {
        const { stack, docker } = harness()
        await stack.attach(request(namespace("shop_aaaaaa"), "run1"))
        await stack.down()
        assert.equal(docker.containers.size, 3)
        await stack.down({ force: true })
        assert.equal(docker.containers.size, 0)
    })
})
