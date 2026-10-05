import assert from "node:assert/strict"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import type { RunContext } from "../jest/context"
import { namespaceOf } from "../stack/namespace"
import type { PgClient, PgConfig, PgConnect } from "../stack/pg"
import { databaseName } from "../stack/services/postgresql"
import { createWriteFault } from "./database-write-fault"

const root = join(tmpdir(), "starci-write-fault-private")
const namespace = namespaceOf(root, 1)
const database = databaseName(namespace.snake, "billing")
const context: RunContext = {
    root,
    slot: 1,
    runId: "private-w1",
    namespace,
    secretSeed: "test",
    infra: {
        toxiproxyApi: "http://127.0.0.1:1",
        postgresql: { host: "127.0.0.1", port: 1, directPort: 2, proxy: "pg", image: "postgres", container: "test", user: "test", password: "synthetic", databases: { billing: database }, schemas: {} },
    },
    fakes: { controlUrl: "http://127.0.0.1:1", entries: {} },
    services: {},
    directories: {},
    keepTables: {},
}

/** A catalog-backed pg double: it models transaction rollback and unknown COMMIT, never connects to a database. */
const postgres = () => {
    const queries: Array<string> = []
    const configs: Array<PgConfig> = []
    let functions: Array<Record<string, unknown>> = []
    let triggers: Array<Record<string, unknown>> = []
    let checkpoint: { functions: typeof functions; triggers: typeof triggers } | null = null
    const control = {
        actualDatabase: database,
        kind: "r",
        partition: false,
        inherited: false,
        missing: false,
        incomplete: false,
        constraints: [{ oid: "1", definition: "FOREIGN KEY (invoice_id) REFERENCES invoices(id)", validated: true }],
        productionTriggers: [{ oid: "2", definition: "CREATE TRIGGER original AFTER INSERT ON event_outbox EXECUTE FUNCTION existing()", enabled: "O" }],
        reject: "",
        unknownCommit: false,
        collision: false,
    }
    const connect: PgConnect = (config) => {
        configs.push(config)
        const client: PgClient = {
            connect: async () => undefined,
            on: () => client,
            end: async () => undefined,
            query: async (text) => {
                queries.push(text)
                if (control.reject !== "" && text.startsWith(control.reject)) throw new Error(`scripted refusal: ${control.reject}`)
                if (text === "BEGIN") checkpoint = structuredClone({ functions, triggers })
                if (text === "ROLLBACK" && checkpoint !== null) ({ functions, triggers } = checkpoint)
                if (text === "COMMIT") {
                    checkpoint = null
                    if (control.unknownCommit) {
                        control.unknownCommit = false
                        throw new Error("COMMIT reply unavailable after server commit")
                    }
                }
                if (text.startsWith("SELECT current_database()")) return { rows: control.missing ? [] : [{ database: control.actualDatabase, oid: "17", relkind: control.kind, relispartition: control.partition, inherited: control.inherited, constraints: control.incomplete ? null : control.constraints, triggers: control.productionTriggers }] }
                if (text.startsWith("SELECT\n            COALESCE")) return { rows: [{ functions: control.collision ? [{ oid: "99", source: "foreign" }] : functions, triggers }] }
                if (text.startsWith("CREATE FUNCTION")) {
                    const source = text.split("$fault$")[1]
                    functions = [{ oid: "42", source, returns: "trigger", arguments: 0, security: false, language: "plpgsql" }]
                }
                if (text.startsWith("CREATE TRIGGER")) triggers = [{ oid: "43", relation: "17", function: "42", type: text.includes("BEFORE INSERT") ? 7 : 11, enabled: "O", internal: false, constraint: "0" }]
                if (text.startsWith("DROP TRIGGER")) triggers = []
                if (text.startsWith("DROP FUNCTION")) functions = []
                return { rows: [] }
            },
        }
        return client
    }
    return { connect, queries, configs, control, replaceIdentities: () => { const fn = functions[0]; const trigger = triggers[0]; if (fn !== undefined && trigger !== undefined) { fn.oid = "52"; trigger.function = "52"; trigger.oid = "53" } }, tamper: () => { const fn = functions[0]; if (fn !== undefined) fn.source = "foreign function" } }
}

test("an INSERT or DELETE fault owns exactly its generated ordinary trigger/function and retains real production constraints", async () => {
    for (const operation of ["insert", "delete"] as const) {
        const pg = postgres()
        const fault = createWriteFault(context, { name: "billing" }, "event_outbox", operation, pg.connect)
        assert.match(fault.name, /^starci_fault_[a-f0-9]{32}$/)
        assert.equal(fault.errorCode, "P0001")
        assert.equal(await fault.count(), 0)
        await fault.install()
        assert.equal(await fault.count(), 2)
        assert.equal(pg.configs.every((config) => config.database === database && config.port === 2), true)
        assert.equal(pg.queries.some((sql) => sql.includes(`BEFORE ${operation.toUpperCase()}`)), true)
        assert.equal(pg.queries.some((sql) => sql.includes(`DETAIL = '${fault.name}'`)), true)
        assert.equal(pg.queries.some((sql) => /DISABLE|DROP CONSTRAINT|session_replication_role|SET CONSTRAINTS|CASCADE/.test(sql)), false)
        await fault.restore()
        assert.equal(await fault.count(), 0)
        await fault.restore()
        assert.equal(pg.control.constraints[0]?.validated, true)
        assert.equal(pg.control.productionTriggers[0]?.enabled, "O")
    }
})

test("foreign slot/database/schema metadata and arbitrary SQL inputs are refused before a client is opened", () => {
    const pg = postgres()
    const run = context.infra.postgresql!
    const altered: Array<RunContext> = [
        { ...context, namespace: { ...namespace, snake: "foreign" } },
        { ...context, slot: 2 },
        { ...context, infra: { ...context.infra, postgresql: { ...run, databases: { billing: "production" } } } },
        { ...context, infra: { ...context.infra, postgresql: { ...run, schemas: { billing: { schema: "foreign", user: "x", password: "synthetic" } } } } },
    ]
    for (const value of altered) assert.throws(() => createWriteFault(value, { name: "billing" }, "event_outbox", "insert", pg.connect))
    for (const table of ["public.event_outbox", "event_outbox; DROP TABLE invoices", ""]) {
        assert.throws(() => createWriteFault(context, { name: "billing" }, table, "insert", pg.connect))
    }
    assert.throws(() => createWriteFault(context, { name: "undeclared" }, "event_outbox", "insert", pg.connect))
    assert.throws(() => createWriteFault(context, { name: "billing" }, "event_outbox", "update" as "insert", pg.connect))
    assert.equal(pg.configs.length, 0)
})

test("actual database mismatch, views, partitions and inheritance refuse installation before object DDL", async () => {
    for (const mutate of [
        (pg: ReturnType<typeof postgres>) => { pg.control.actualDatabase = "production" },
        (pg: ReturnType<typeof postgres>) => { pg.control.kind = "v" },
        (pg: ReturnType<typeof postgres>) => { pg.control.partition = true },
        (pg: ReturnType<typeof postgres>) => { pg.control.inherited = true },
        (pg: ReturnType<typeof postgres>) => { pg.control.missing = true },
        (pg: ReturnType<typeof postgres>) => { pg.control.incomplete = true },
    ]) {
        const pg = postgres()
        mutate(pg)
        const fault = createWriteFault(context, { name: "billing" }, "event_outbox", "insert", pg.connect)
        await assert.rejects(fault.install())
        assert.equal(pg.queries.some((sql) => sql.startsWith("CREATE")), false)
    }
})

test("a generated-name collision never replaces or removes someone else's object", async () => {
    const pg = postgres()
    pg.control.collision = true
    const fault = createWriteFault(context, { name: "billing" }, "event_outbox", "insert", pg.connect)
    await assert.rejects(fault.install(), /already exists/)
    await assert.rejects(fault.restore())
    assert.equal(pg.queries.some((sql) => sql.startsWith("CREATE") || sql.startsWith("DROP")), false)
})

test("failed creation rolls back; an unknown committed install remains removable only under the same owner's catalog identity", async () => {
    const pg = postgres()
    const fault = createWriteFault(context, { name: "billing" }, "event_outbox", "insert", pg.connect)
    pg.control.reject = "CREATE TRIGGER"
    await assert.rejects(fault.install(), /scripted refusal/)
    assert.equal(await fault.count(), 0)
    pg.control.reject = ""
    await fault.restore()
    const unknownPg = postgres()
    const unknown = createWriteFault(context, { name: "billing" }, "event_outbox", "delete", unknownPg.connect)
    unknownPg.control.unknownCommit = true
    await assert.rejects(unknown.install(), /COMMIT reply unavailable/)
    assert.equal(await unknown.count(), 2)
    await unknown.restore()
    assert.equal(await unknown.count(), 0)
})

test("changed object definitions and production constraints retain custody instead of blind DROP", async () => {
    const pg = postgres()
    const fault = createWriteFault(context, { name: "billing" }, "event_outbox", "insert", pg.connect)
    await fault.install()
    pg.tamper()
    await assert.rejects(fault.restore(), /not this owner's fault/)
    assert.equal(pg.queries.some((sql) => sql.startsWith("DROP")), false)
    const replacedPg = postgres()
    const replaced = createWriteFault(context, { name: "billing" }, "event_outbox", "insert", replacedPg.connect)
    await replaced.install()
    replacedPg.replaceIdentities()
    await assert.rejects(replaced.restore(), /captured fault object identity changed/)
    assert.equal(replacedPg.queries.some((sql) => sql.startsWith("DROP")), false)
    const otherPg = postgres()
    const other = createWriteFault(context, { name: "billing" }, "event_outbox", "insert", otherPg.connect)
    await other.install()
    otherPg.control.constraints = []
    await assert.rejects(other.restore(), /constraints or existing triggers changed/)
    assert.equal(otherPg.queries.some((sql) => sql.startsWith("DROP")), false)
})

test("a failed cleanup remains red and can be explicitly retried without reinstalling", async () => {
    const pg = postgres()
    const fault = createWriteFault(context, { name: "billing" }, "event_outbox", "delete", pg.connect)
    await fault.install()
    pg.control.reject = "DROP FUNCTION"
    await assert.rejects(fault.restore(), /scripted refusal/)
    assert.equal(await fault.count(), 2)
    pg.control.reject = ""
    await fault.restore()
    assert.equal(await fault.count(), 0)
})
