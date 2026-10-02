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

const namespace: Namespace = { snake: "todo_app_be_a1b2c3", kebab: "todo-app-be-a1b2c3", root: "/repo" }

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
            input({ postgresql: { connections: [{ name: "primary", extensions: ["vector", "pgcrypto"] }, { name: "analytics" }] } }),
        )
        assert.deepEqual(result.run, {
            user: "postgres",
            password: "pw",
            databases: { primary: "todo_app_be_a1b2c3_primary", analytics: "todo_app_be_a1b2c3_analytics" },
            schemas: {},
        })
        assert.deepEqual(log, [
            { database: "postgres", sql: 'DROP DATABASE IF EXISTS "todo_app_be_a1b2c3_primary" WITH (FORCE)' },
            { database: "postgres", sql: 'CREATE DATABASE "todo_app_be_a1b2c3_primary"' },
            { database: "postgres", sql: 'DROP DATABASE IF EXISTS "todo_app_be_a1b2c3_analytics" WITH (FORCE)' },
            { database: "postgres", sql: 'CREATE DATABASE "todo_app_be_a1b2c3_analytics"' },
            { database: "todo_app_be_a1b2c3_primary", sql: 'CREATE EXTENSION IF NOT EXISTS "vector" SCHEMA public' },
            { database: "todo_app_be_a1b2c3_primary", sql: 'CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public' },
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
            databases: { primary: "todo_app_be_a1b2c3_primary" },
            schemas: {},
        }
        await postgresService.reset(targetWith({ pg: scriptedPg(log, tables, ['TRUNCATE TABLE "public"."users" RESTART IDENTITY']) }), run, { namespace, keepTables: { primary: ["roles"] }, notes: {} })
        const sql = log.map((entry) => entry.sql)
        assert.equal(sql[0], "SET session_replication_role = replica")
        assert.match(sql[1] ?? "", /FROM pg_tables/)
        assert.deepEqual(sql.slice(2), ['TRUNCATE TABLE "public"."users" RESTART IDENTITY', 'DELETE FROM "public"."users"', 'TRUNCATE TABLE "public"."orders" RESTART IDENTITY'])
        assert.ok(log.every((entry) => entry.database === "todo_app_be_a1b2c3_primary"))
    })

    it("schema-per-context: connections naming one database share it, each with its schema and its own login role", async () => {
        const log: Array<PgLog> = []
        const result = await postgresService.provision(
            targetWith({ pg: scriptedPg(log) }),
            input({
                postgresql: {
                    connections: [
                        { name: "identity", database: "core", schema: "identity", extensions: ["pgcrypto"] },
                        { name: "order", database: "core", schema: "ordering" },
                        { name: "analytics" },
                    ],
                },
            }),
        )
        const { databases, schemas } = result.run
        assert.deepEqual(databases, { identity: "todo_app_be_a1b2c3_core", order: "todo_app_be_a1b2c3_core", analytics: "todo_app_be_a1b2c3_analytics" })
        assert.deepEqual(Object.keys(schemas).sort(), ["identity", "order"])
        assert.equal(schemas.identity?.schema, "identity")
        assert.equal(schemas.identity?.user, "todo_app_be_a1b2c3_identity")
        assert.equal(schemas.order?.user, "todo_app_be_a1b2c3_order")
        assert.notEqual(schemas.identity?.password, schemas.order?.password)
        const sql = log.map((entry) => `${entry.database}: ${entry.sql.replace(/PASSWORD '[^']*'/, "PASSWORD <generated>")}`)
        assert.deepEqual(sql, [
            'postgres: DROP DATABASE IF EXISTS "todo_app_be_a1b2c3_core" WITH (FORCE)',
            'postgres: CREATE DATABASE "todo_app_be_a1b2c3_core"',
            'postgres: DROP DATABASE IF EXISTS "todo_app_be_a1b2c3_analytics" WITH (FORCE)',
            'postgres: CREATE DATABASE "todo_app_be_a1b2c3_analytics"',
            'postgres: DROP ROLE IF EXISTS "todo_app_be_a1b2c3_identity"',
            'postgres: CREATE ROLE "todo_app_be_a1b2c3_identity" LOGIN PASSWORD <generated>',
            'postgres: DROP ROLE IF EXISTS "todo_app_be_a1b2c3_order"',
            'postgres: CREATE ROLE "todo_app_be_a1b2c3_order" LOGIN PASSWORD <generated>',
            'todo_app_be_a1b2c3_core: CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public',
            'todo_app_be_a1b2c3_core: CREATE SCHEMA IF NOT EXISTS "identity" AUTHORIZATION "todo_app_be_a1b2c3_identity"',
            'todo_app_be_a1b2c3_core: ALTER ROLE "todo_app_be_a1b2c3_identity" IN DATABASE "todo_app_be_a1b2c3_core" SET search_path = "identity", public',
            'todo_app_be_a1b2c3_core: GRANT CONNECT, TEMPORARY ON DATABASE "todo_app_be_a1b2c3_core" TO "todo_app_be_a1b2c3_identity"',
            'todo_app_be_a1b2c3_core: GRANT USAGE ON SCHEMA public TO "todo_app_be_a1b2c3_identity"',
            'todo_app_be_a1b2c3_core: CREATE SCHEMA IF NOT EXISTS "ordering" AUTHORIZATION "todo_app_be_a1b2c3_order"',
            'todo_app_be_a1b2c3_core: ALTER ROLE "todo_app_be_a1b2c3_order" IN DATABASE "todo_app_be_a1b2c3_core" SET search_path = "ordering", public',
            'todo_app_be_a1b2c3_core: GRANT CONNECT, TEMPORARY ON DATABASE "todo_app_be_a1b2c3_core" TO "todo_app_be_a1b2c3_order"',
            'todo_app_be_a1b2c3_core: GRANT USAGE ON SCHEMA public TO "todo_app_be_a1b2c3_order"',
        ])
    })

    it("schema-per-context reset empties only the connection's schema; deprovision drops each shared database once and the roles", async () => {
        const tables = [
            { schemaname: "identity", tablename: "persons" },
            { schemaname: "ordering", tablename: "orders" },
            { schemaname: "ordering", tablename: "typeorm_migrations" },
        ]
        const run: RunPostgres = {
            host: "127.0.0.1",
            port: 30100,
            directPort: 5555,
            proxy: "r1-postgresql",
            image: "postgres:16",
            container: "c",
            user: "postgres",
            password: "pw",
            databases: { identity: "ns_core", order: "ns_core" },
            schemas: { identity: { schema: "identity", user: "ns_identity", password: "a" }, order: { schema: "ordering", user: "ns_order", password: "b" } },
        }
        const log: Array<PgLog> = []
        await postgresService.reset(targetWith({ pg: scriptedPg(log, tables) }), run, { namespace, keepTables: {}, notes: {} })
        const truncated = log.map((entry) => entry.sql).filter((sql) => sql.startsWith("TRUNCATE"))
        assert.deepEqual(truncated, ['TRUNCATE TABLE "identity"."persons" RESTART IDENTITY', 'TRUNCATE TABLE "ordering"."orders" RESTART IDENTITY'])
        const dropped: Array<PgLog> = []
        await postgresService.deprovision(targetWith({ pg: scriptedPg(dropped) }), run, { namespace, releaseRedisDb: async () => undefined })
        assert.deepEqual(dropped.map((entry) => entry.sql), ['DROP DATABASE IF EXISTS "ns_core" WITH (FORCE)', 'DROP ROLE IF EXISTS "ns_identity"', 'DROP ROLE IF EXISTS "ns_order"'])
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
            return { code: 0, stdout: args.includes("--list") ? "other.topic\ntodo-app-be-a1b2c3.orders\ntodo-app-be-a1b2c3.mail\n" : "", stderr: "" }
        })
        const target = targetWith({ docker })
        const provisioned = await kafkaService.provision(target, input({ kafka: { topics: ["orders"] } }))
        assert.deepEqual(provisioned.run, { topicPrefix: "todo-app-be-a1b2c3.", topics: { orders: "todo-app-be-a1b2c3.orders" } })
        assert.deepEqual(calls[0], ["exec", "starci-ts-postgresql-11111111", "/opt/kafka/bin/kafka-topics.sh", "--bootstrap-server", "localhost:9092", "--create", "--if-not-exists", "--topic", "todo-app-be-a1b2c3.orders", "--partitions", "1", "--replication-factor", "1"])
        calls.length = 0
        const run = { topicPrefix: "todo-app-be-a1b2c3.", topics: {} } as unknown as RunKafka
        await kafkaService.deprovision(target, run, { namespace, releaseRedisDb: async () => undefined })
        assert.equal(calls.length, 3)
        assert.ok(calls[0]?.includes("--list"))
        assert.deepEqual(calls.slice(1).map((args) => args.slice(-2).join(" ")), ["--topic todo-app-be-a1b2c3.orders", "--topic todo-app-be-a1b2c3.mail"])
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
        realm: "todo-app",
        clients: [{ clientId: "backend", directAccessGrantsEnabled: false }, { clientId: "web", directAccessGrantsEnabled: true }],
        users: [{ username: "Admin" }],
    })

    it("re-targets the realm name, drops the id, detects the password client and lists seed users", () => {
        const prepared = prepareRealm(file, "todo-app-be-a1b2c3", "realm.json")
        assert.equal(prepared.stored, "todo-app-be-a1b2c3-todo-app")
        assert.equal(prepared.body.realm, "todo-app-be-a1b2c3-todo-app")
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

    it("gives every namespace its own entity ids: user ids remapped (stable per namespace), other ids dropped", () => {
        const pinned = "4f1c2b7e-8a3d-4e5f-9b6a-0c1d2e3f4a5b"
        const exported = JSON.stringify({
            realm: "shop",
            clients: [{ id: "c-1", clientId: "web", publicClient: true, directAccessGrantsEnabled: true }],
            users: [{ id: pinned, username: "demo@shop.dev" }, { username: "no-id" }],
            roles: { realm: [{ id: "r-1", name: "admin" }], client: { web: [{ id: "r-2", name: "reader" }] } },
            groups: [{ id: "g-1", name: "staff", subGroups: [{ id: "g-2", name: "leads" }] }],
            clientScopes: [{ id: "s-1", name: "profile" }],
            components: { "org.keycloak.keys.KeyProvider": [{ id: "k-1", name: "rsa", subComponents: { x: [{ id: "k-2", name: "sub" }] } }] },
        })
        const one = prepareRealm(exported, "shop-a1b2c3-w1", "realm.json")
        const two = prepareRealm(exported, "shop-a1b2c3-w2", "realm.json")
        const idOf = (prepared: typeof one): unknown => (prepared.body.users as ReadonlyArray<Record<string, unknown>>)[0]?.id
        assert.match(String(idOf(one)), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
        assert.notEqual(idOf(one), idOf(two))
        assert.notEqual(idOf(one), pinned)
        assert.deepEqual(one.userIds, { [pinned]: idOf(one) })
        assert.deepEqual(prepareRealm(exported, "shop-a1b2c3-w1", "realm.json").userIds, one.userIds, "stable per namespace")
        assert.equal("id" in ((one.body.users as ReadonlyArray<Record<string, unknown>>)[1] ?? {}), false)
        const text = JSON.stringify(one.body)
        for (const dropped of ["c-1", "r-1", "r-2", "g-1", "g-2", "s-1", "k-1", "k-2"]) assert.equal(text.includes(`"${dropped}"`), false, dropped)
        assert.match(text, /"name":"leads"/)
        assert.match(text, /"name":"sub"/)
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
        const result = await s3Request(targetWith({ fetch: fake }), { accessKey: "ak", secretKey: "sk" }, "GET", "/todo-app-be-a1b2c3-uploads", { "list-type": "2" }, new Date("2026-01-02T03:04:05Z"))
        assert.equal(result.status, 200)
        const captured = seen as unknown as { url: string; headers: Record<string, string> }
        assert.equal(captured.url, "http://127.0.0.1:5555/todo-app-be-a1b2c3-uploads?list-type=2")
        assert.equal(captured.headers["x-amz-date"], "20260102T030405Z")
        assert.match(captured.headers.authorization ?? "", /^AWS4-HMAC-SHA256 Credential=ak\/20260102\/us-east-1\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/)
    })
})
