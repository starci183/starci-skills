import assert from "node:assert/strict"
import test from "node:test"
import type { RunPostgres } from "../stack/contracts"
import type { PgClient, PgConfig, PgConnect } from "../stack/pg"
import { cutConnection, cutDatabase, databaseOf, restoreConnections, restoreDatabases } from "./database-outage"

const RUN: RunPostgres = {
    host: "127.0.0.1",
    port: 1,
    directPort: 5544,
    proxy: "pg",
    image: "postgres:16",
    container: "c",
    user: "su",
    password: "pw",
    databases: { identity: "shop_ab12cd_identity", order: "shop_ab12cd_order" },
    schemas: {},
}

interface Scripted {
    readonly connect: PgConnect
    readonly configs: Array<PgConfig>
    readonly queries: Array<string>
    readonly ended: { count: number }
}

/** A scripted pg client: records where it connected and every statement, in order. */
const scripted = (): Scripted => {
    const configs: Array<PgConfig> = []
    const queries: Array<string> = []
    const ended = { count: 0 }
    const connect: PgConnect = (config) => {
        configs.push(config)
        const client: PgClient = {
            connect: async () => undefined,
            query: async (text) => {
                queries.push(text)
                return { rows: [] }
            },
            end: async () => {
                ended.count += 1
            },
            on: () => client,
        }
        return client
    }
    return { connect, configs, queries, ended }
}

test("cutting one connection's database refuses new connections and terminates its sessions, as the superuser on the direct port", async () => {
    const pg = scripted()
    await cutDatabase(RUN, databaseOf(RUN, "order"), pg.connect)
    assert.deepEqual(pg.configs, [{ host: "127.0.0.1", port: 5544, user: "su", password: "pw", database: "postgres" }])
    assert.deepEqual(pg.queries, [
        `ALTER DATABASE "shop_ab12cd_order" ALLOW_CONNECTIONS false`,
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'shop_ab12cd_order' AND pid <> pg_backend_pid()`,
    ])
    assert.equal(pg.ended.count, 1)
})

test("restoring lets each database accept connections again and never touches another", async () => {
    const pg = scripted()
    await restoreDatabases(RUN, ["shop_ab12cd_order"], pg.connect)
    assert.deepEqual(pg.queries, [`ALTER DATABASE "shop_ab12cd_order" ALLOW_CONNECTIONS true`])
})

test("a connection the run did not declare is a NotDeclared failure naming the declared ones", () => {
    assert.throws(() => databaseOf(RUN, "billing"), /infra\.postgresql\.connection\(billing\) is not a declared connection \(identity, order\)/)
})

const SHARED: RunPostgres = {
    ...RUN,
    databases: { identity: "shop_ab12cd_core", order: "shop_ab12cd_core", audit: "shop_ab12cd_audit" },
    schemas: { identity: { schema: "identity", user: "shop_ab12cd_identity", password: "a" }, order: { schema: "ordering", user: "shop_ab12cd_order", password: "b" } },
}

test("cutting a schema-per-context connection stops its own login only, so the contexts beside it in the database keep serving", async () => {
    const pg = scripted()
    await cutConnection(SHARED, "order", pg.connect)
    assert.deepEqual(pg.queries, [
        `ALTER ROLE "shop_ab12cd_order" NOLOGIN`,
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = 'shop_ab12cd_order' AND datname = 'shop_ab12cd_core' AND pid <> pg_backend_pid()`,
    ])
    assert.equal(pg.queries.some((query) => query.includes("ALLOW_CONNECTIONS")), false, "the shared database stays open")
})

test("cutting a connection with a database of its own takes that database down; restoring brings back each kind", async () => {
    const pg = scripted()
    await cutConnection(SHARED, "audit", pg.connect)
    assert.equal(pg.queries[0], `ALTER DATABASE "shop_ab12cd_audit" ALLOW_CONNECTIONS false`)
    const back = scripted()
    await restoreConnections(SHARED, ["audit", "order"], back.connect)
    assert.deepEqual(back.queries, [`ALTER DATABASE "shop_ab12cd_audit" ALLOW_CONNECTIONS true`, `ALTER ROLE "shop_ab12cd_order" LOGIN`])
})
