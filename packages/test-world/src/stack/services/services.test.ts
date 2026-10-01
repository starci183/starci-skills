import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { AttachRequest, Namespace, RunKafka, RunPostgres } from "../contracts"
import { Docker } from "../docker"
import type { ExecResult } from "../exec"
import type { PgClient, PgConfig } from "../pg"
import { kafkaService } from "./kafka"
import { prepareRealm } from "./keycloak"
import { postgresService, truncateStatements } from "./postgresql"
import { s3Request } from "./minio"
import type { ServiceNet, ServiceTarget } from "./definition"

const namespace: Namespace = { snake: "nivo_backend_a1b2c3", kebab: "nivo-backend-a1b2c3", root: "/repo" }

interface PgLog {
    readonly database: string
    readonly sql: string
}

const scriptedPg = (log: Array<PgLog>, tables: ReadonlyArray<Record<string, unknown>> = [], failing: ReadonlyArray<string> = []) => (config: PgConfig): PgClient => ({
    connect: async () => undefined,
    on: () => undefined,
    end: async () => undefined,
    query: async (sql: string) => {
        log.push({ database: config.database, sql })
        if (failing.includes(sql)) throw new Error("cannot truncate a table referenced in a foreign key constraint")
        return { rows: sql.includes("pg_tables") ? tables : [{ "?column?": 1 }] }
    },
})

const targetWith = (net: Partial<ServiceNet>, secrets: Record<string, string> = { password: "pw" }): ServiceTarget => ({
    container: "starci-ts-postgresql-11111111",
    image: "pgvector/pgvector:pg16",
    host: "127.0.0.1",
    port: 5555,
    secrets,
    net: { docker: new Docker(), fetch, pg: scriptedPg([]), redis: async () => [], pause: async () => undefined, ...net },
})

const request = (extra: Partial<AttachRequest>): AttachRequest => ({ namespace, runId: "r1", services: [], ...extra })
const input = (extra: Partial<AttachRequest>) => ({ namespace, request: request(extra), leaseRedisDb: async () => 0 })

describe("postgresql service", () => {
    it("readiness is a real select 1", async () => {
        const log: Array<PgLog> = []
        assert.equal(await postgresService.ready(targetWith({ pg: scriptedPg(log) })), true)
        assert.deepEqual(log, [{ database: "postgres", sql: "select 1" }])
    })

    it("provision drops, creates and adds extensions per connection under <snake>_<connection>", async () => {
        const log: Array<PgLog> = []
        const result = await postgresService.provision(
            targetWith({ pg: scriptedPg(log) }),
            input({ postgresql: { connections: [{ name: "primary", extensions: ["vector", "pgcrypto"] }, { name: "agentos" }] } }),
        )
        assert.deepEqual(result.run, {
            user: "postgres",
            password: "pw",
            databases: { primary: "nivo_backend_a1b2c3_primary", agentos: "nivo_backend_a1b2c3_agentos" },
        })
        assert.deepEqual(log, [
            { database: "postgres", sql: 'DROP DATABASE IF EXISTS "nivo_backend_a1b2c3_primary" WITH (FORCE)' },
            { database: "postgres", sql: 'CREATE DATABASE "nivo_backend_a1b2c3_primary"' },
            { database: "postgres", sql: 'DROP DATABASE IF EXISTS "nivo_backend_a1b2c3_agentos" WITH (FORCE)' },
            { database: "postgres", sql: 'CREATE DATABASE "nivo_backend_a1b2c3_agentos"' },
            { database: "nivo_backend_a1b2c3_primary", sql: 'CREATE EXTENSION IF NOT EXISTS "vector"' },
            { database: "nivo_backend_a1b2c3_primary", sql: 'CREATE EXTENSION IF NOT EXISTS "pgcrypto"' },
        ])
    })

    it("reset truncates every table except ledgers and keepTables, with triggers off, falling back to DELETE on an FK refusal", async () => {
        const log: Array<PgLog> = []
        const tables = [
            { schemaname: "public", tablename: "users" },
            { schemaname: "public", tablename: "orders" },
            { schemaname: "public", tablename: "roles" },
            { schemaname: "public", tablename: "typeorm_migrations" },
            { schemaname: "public", tablename: "typeorm_metadata" },
            { schemaname: "audit", tablename: "kysely_migrations_lock" },
        ]
        const run: RunPostgres = {
            host: "127.0.0.1",
            port: 30100,
            directPort: 5555,
            proxy: "r1-postgresql",
            image: "pgvector/pgvector:pg16",
            container: "c",
            user: "postgres",
            password: "pw",
            databases: { primary: "nivo_backend_a1b2c3_primary" },
        }
        await postgresService.reset(targetWith({ pg: scriptedPg(log, tables, ['TRUNCATE TABLE "public"."users" RESTART IDENTITY']) }), run, { namespace, keepTables: { primary: ["roles"] }, notes: {} })
        const sql = log.map((entry) => entry.sql)
        assert.equal(sql[0], "SET session_replication_role = replica")
        assert.match(sql[1] ?? "", /FROM pg_tables/)
        assert.deepEqual(sql.slice(2), ['TRUNCATE TABLE "public"."users" RESTART IDENTITY', 'DELETE FROM "public"."users"', 'TRUNCATE TABLE "public"."orders" RESTART IDENTITY'])
        assert.ok(log.every((entry) => entry.database === "nivo_backend_a1b2c3_primary"))
    })

    it("truncateStatements skips migration ledgers and kept tables by name or schema.name", () => {
        const statements = truncateStatements(
            [
                { schema: "public", table: "a" },
                { schema: "public", table: "SequelizeMigrations" },
                { schema: "x", table: "b" },
                { schema: "x", table: "c" },
            ],
            ["x.b"],
        )
        assert.deepEqual(statements.map((statement) => statement.truncate), ['TRUNCATE TABLE "public"."a" RESTART IDENTITY', 'TRUNCATE TABLE "x"."c" RESTART IDENTITY'])
    })
})

describe("kafka service", () => {
    it("creates prefixed topics with docker exec and deletes every prefixed topic on deprovision", async () => {
        const calls: Array<ReadonlyArray<string>> = []
        const docker = new Docker(async (_command, args): Promise<ExecResult> => {
            calls.push(args)
            return { code: 0, stdout: args.includes("--list") ? "other.topic\nnivo-backend-a1b2c3.orders\nnivo-backend-a1b2c3.mail\n" : "", stderr: "" }
        })
        const target = targetWith({ docker })
        const provisioned = await kafkaService.provision(target, input({ kafka: { topics: ["orders"] } }))
        assert.deepEqual(provisioned.run, { topicPrefix: "nivo-backend-a1b2c3.", topics: { orders: "nivo-backend-a1b2c3.orders" } })
        assert.deepEqual(calls[0], ["exec", "starci-ts-postgresql-11111111", "/opt/kafka/bin/kafka-topics.sh", "--bootstrap-server", "localhost:9092", "--create", "--if-not-exists", "--topic", "nivo-backend-a1b2c3.orders", "--partitions", "1", "--replication-factor", "1"])
        calls.length = 0
        const run = { topicPrefix: "nivo-backend-a1b2c3.", topics: {} } as unknown as RunKafka
        await kafkaService.deprovision(target, run, { namespace, releaseRedisDb: async () => undefined })
        assert.equal(calls.length, 3)
        assert.ok(calls[0]?.includes("--list"))
        assert.deepEqual(calls.slice(1).map((args) => args.slice(-2).join(" ")), ["--topic nivo-backend-a1b2c3.orders", "--topic nivo-backend-a1b2c3.mail"])
        assert.ok(calls.slice(1).every((args) => args.includes("--delete")))
    })

    it("advertises the stack-wide proxy port", () => {
        const spec = kafkaService.spec("apache/kafka:3.9.0", {}, { advertisedPort: 30101 })
        assert.match(spec.env.KAFKA_ADVERTISED_LISTENERS ?? "", /EXTERNAL:\/\/127\.0\.0\.1:30101$/)
    })
})

describe("keycloak realm preparation", () => {
    const file = JSON.stringify({
        id: "abc",
        realm: "nivo",
        clients: [{ clientId: "backend", directAccessGrantsEnabled: false }, { clientId: "web", directAccessGrantsEnabled: true }],
        users: [{ username: "Admin" }],
    })

    it("re-targets the realm name, drops the id, detects the password client and lists seed users", () => {
        const prepared = prepareRealm(file, "nivo-backend-a1b2c3", "realm.json")
        assert.equal(prepared.stored, "nivo-backend-a1b2c3-nivo")
        assert.equal(prepared.body.realm, "nivo-backend-a1b2c3-nivo")
        assert.equal("id" in prepared.body, false)
        assert.equal(prepared.passwordClientId, "web")
        assert.deepEqual(prepared.seedUsers, ["admin"])
    })

    it("gives every confidential client a secret generated for the run, never the file's, and leaves public clients alone", () => {
        const withSecrets = JSON.stringify({
            realm: "shop",
            clients: [
                { clientId: "web", publicClient: true, directAccessGrantsEnabled: true },
                { clientId: "admin-reader", publicClient: false, serviceAccountsEnabled: true, secret: "committed" },
                { clientId: "api", bearerOnly: true },
            ],
        })
        let next = 0
        const prepared = prepareRealm(withSecrets, "k", "realm.json", () => `generated-${(next += 1)}`)
        assert.deepEqual(prepared.clientSecrets, { "admin-reader": "generated-1" })
        const clients = prepared.body.clients as ReadonlyArray<Record<string, unknown>>
        assert.equal(clients.find((client) => client.clientId === "admin-reader")?.secret, "generated-1")
        assert.equal("secret" in (clients.find((client) => client.clientId === "web") ?? {}), false)
        assert.equal("secret" in (clients.find((client) => client.clientId === "api") ?? {}), false)
    })

    it("refuses a file without a realm name", () => {
        assert.throws(() => prepareRealm("{}", "k", "realm.json"), /no "realm"/)
    })
})

describe("minio s3 client", () => {
    it("signs path-style requests with sigv4 and no aws sdk", async () => {
        let seen: { url: string; headers: Record<string, string> } | null = null
        const fake = (async (url: string | URL | Request, init?: RequestInit) => {
            seen = { url: String(url), headers: init?.headers as Record<string, string> }
            return new Response("<ListAllMyBucketsResult/>", { status: 200 })
        }) as typeof fetch
        const result = await s3Request(targetWith({ fetch: fake }), { accessKey: "ak", secretKey: "sk" }, "GET", "/nivo-backend-a1b2c3-uploads", { "list-type": "2" }, new Date("2026-01-02T03:04:05Z"))
        assert.equal(result.status, 200)
        const captured = seen as unknown as { url: string; headers: Record<string, string> }
        assert.equal(captured.url, "http://127.0.0.1:5555/nivo-backend-a1b2c3-uploads?list-type=2")
        assert.equal(captured.headers["x-amz-date"], "20260102T030405Z")
        assert.match(captured.headers.authorization ?? "", /^AWS4-HMAC-SHA256 Credential=ak\/20260102\/us-east-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/)
    })
})
