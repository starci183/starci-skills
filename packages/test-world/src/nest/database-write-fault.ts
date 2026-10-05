import { randomUUID } from "node:crypto"
import type { PostgresConnectionDeclaration } from "../config/types"
import { TestWorldErrorCode, worldError } from "../errors"
import type { RunContext } from "../jest/context"
import { namespaceOf, normalisedRoot } from "../stack/namespace"
import { quoteIdent, realPgConnect, withPg } from "../stack/pg"
import type { PgClient, PgConnect, PgConfig } from "../stack/pg"
import { databaseName, logicalDatabaseOf } from "../stack/services/postgresql"
import type { PostgresWriteFault, PostgresWriteOperation } from "./world-types"

const IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/
const SQLSTATE = "P0001"

interface TableState {
    readonly oid: string
    readonly constraints: ReadonlyArray<unknown>
    readonly triggers: ReadonlyArray<unknown>
}

interface FaultObjects {
    readonly functions: ReadonlyArray<Record<string, unknown>>
    readonly triggers: ReadonlyArray<Record<string, unknown>>
}

const failure = (detail: string) => worldError(TestWorldErrorCode.InfrastructureFailed, `Postgres write fault: ${detail}`)

const identifier = (value: string): string => {
    if (!IDENTIFIER.test(value)) throw worldError(TestWorldErrorCode.ConfigInvalid, "a write fault accepts one plain table identifier, without a caller schema or SQL")
    return value
}

const records = (value: unknown): ReadonlyArray<Record<string, unknown>> => {
    if (!Array.isArray(value) || value.some((entry) => typeof entry !== "object" || entry === null || Array.isArray(entry))) throw failure("the catalog response is incomplete")
    return value as ReadonlyArray<Record<string, unknown>>
}

/** Transaction rollback failure remains visible beside the original unknown effect. */
const transaction = async <T>(client: PgClient, work: () => Promise<T>): Promise<T> => {
    await client.query("BEGIN")
    try {
        const result = await work()
        await client.query("COMMIT")
        return result
    } catch (cause) {
        try {
            await client.query("ROLLBACK")
        } catch (rollback) {
            throw new AggregateError([cause, rollback], "write-fault transaction and rollback failed")
        }
        throw cause
    }
}

/**
 * A TestWorld-owned ordinary trigger on one regular table in the provisioned slot. The caller supplies no coordinates,
 * schema, SQL, function body or error code. Creation and removal preserve the table's original constraints and triggers.
 */
export const createWriteFault = (
    context: RunContext,
    connection: PostgresConnectionDeclaration,
    table: string,
    operation: PostgresWriteOperation,
    connect: PgConnect = realPgConnect,
): PostgresWriteFault => {
    const run = context.infra.postgresql
    if (run === undefined || run.databases[connection.name] === undefined) throw worldError(TestWorldErrorCode.NotDeclared, `Postgres connection ${connection.name} was not provisioned`)
    if (operation !== "insert" && operation !== "delete") throw worldError(TestWorldErrorCode.ConfigInvalid, "a write fault operation is insert or delete")
    identifier(table)
    if (!Number.isInteger(context.slot) || context.slot < 1 || normalisedRoot(context.root) !== normalisedRoot(context.namespace.root) || namespaceOf(context.root, context.slot).snake !== context.namespace.snake) throw failure("slot and namespace metadata disagree")
    const database = databaseName(context.namespace.snake, logicalDatabaseOf(connection))
    if (run.databases[connection.name] !== database) throw failure("the connection database differs from provisioned slot metadata")
    const login = run.schemas[connection.name]
    if (connection.schema === undefined ? login !== undefined : login?.schema !== connection.schema) throw failure("the connection schema differs from its declaration")
    const schema = identifier(connection.schema ?? "public")
    if (run.host !== "127.0.0.1" || !Number.isInteger(run.directPort) || run.directPort <= 0) throw failure("the private stack endpoint is invalid")
    const config: PgConfig = { host: run.host, port: run.directPort, user: run.user, password: run.password, database }
    const name = `starci_fault_${randomUUID().replace(/-/g, "")}`
    const relation = `${quoteIdent(schema)}.${quoteIdent(table)}`
    const functionName = `${quoteIdent(schema)}.${quoteIdent(name)}`
    const body = `BEGIN RAISE EXCEPTION 'TestWorld write fault' USING ERRCODE = '${SQLSTATE}', DETAIL = '${name}'; END;`
    const triggerType = operation === "insert" ? 7 : 11
    let original: TableState | null = null
    let identities: { function: string; trigger: string } | null = null

    const state = async (client: PgClient): Promise<TableState> => {
        const result = await client.query(`SELECT current_database() AS database, c.oid::text AS oid, c.relkind, c.relispartition,
            EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid = c.oid OR inhparent = c.oid) AS inherited,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('oid', k.oid::text, 'definition', pg_get_constraintdef(k.oid), 'validated', k.convalidated) ORDER BY k.oid) FROM pg_constraint k WHERE k.conrelid = c.oid), '[]'::jsonb) AS constraints,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('oid', t.oid::text, 'definition', pg_get_triggerdef(t.oid), 'enabled', t.tgenabled) ORDER BY t.oid) FROM pg_trigger t WHERE t.tgrelid = c.oid AND t.tgname <> '${name}'), '[]'::jsonb) AS triggers
            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = '${schema}' AND c.relname = '${table}'`)
        const [row] = result.rows
        if (result.rows.length !== 1 || row?.database !== database || row.relkind !== "r" || row.relispartition !== false || row.inherited !== false || typeof row.oid !== "string" || !/^\d+$/.test(row.oid)) throw failure("the actual database or regular table identity is not the provisioned target")
        const current = { oid: row.oid, constraints: records(row.constraints), triggers: records(row.triggers) }
        if (original !== null && JSON.stringify(current) !== JSON.stringify(original)) throw failure("production table identity, constraints or existing triggers changed")
        return current
    }

    const objects = async (client: PgClient): Promise<FaultObjects> => {
        const result = await client.query(`SELECT
            COALESCE((SELECT jsonb_agg(jsonb_build_object('oid', p.oid::text, 'source', p.prosrc, 'returns', p.prorettype::regtype::text, 'arguments', p.pronargs, 'security', p.prosecdef, 'language', l.lanname) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_language l ON l.oid = p.prolang WHERE n.nspname = '${schema}' AND p.proname = '${name}'), '[]'::jsonb) AS functions,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('oid', t.oid::text, 'relation', t.tgrelid::text, 'function', t.tgfoid::text, 'type', t.tgtype, 'enabled', t.tgenabled, 'internal', t.tgisinternal, 'constraint', t.tgconstraint::text) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = '${schema}' AND t.tgname = '${name}'), '[]'::jsonb) AS triggers`)
        const [row] = result.rows
        if (result.rows.length !== 1 || row === undefined) throw failure("the fault census is incomplete")
        return { functions: records(row.functions), triggers: records(row.triggers) }
    }

    const owned = (found: FaultObjects): void => {
        if (found.functions.length > 1 || found.triggers.length > 1) throw failure("generated fault identity collided")
        const [fn] = found.functions
        const [trigger] = found.triggers
        if (fn !== undefined && (fn.source !== body || fn.returns !== "trigger" || fn.arguments !== 0 || fn.security !== false || fn.language !== "plpgsql" || typeof fn.oid !== "string")) throw failure("the generated function is not this owner's fault")
        if (trigger !== undefined && (fn === undefined || trigger.relation !== original?.oid || trigger.function !== fn.oid || trigger.type !== triggerType || trigger.enabled !== "O" || trigger.internal !== false || trigger.constraint !== "0")) throw failure("the generated trigger is not this owner's fault")
        if (identities !== null && ((fn !== undefined && fn.oid !== identities.function) || (trigger !== undefined && trigger.oid !== identities.trigger))) throw failure("captured fault object identity changed")
        if (original === null && (fn !== undefined || trigger !== undefined)) throw failure("an unprovisioned handle cannot remove an existing object")
    }

    const count = (): Promise<number> => withPg(connect, config, async (client) => {
        await state(client)
        const found = await objects(client)
        owned(found)
        return found.functions.length + found.triggers.length
    })

    return {
        name,
        errorCode: SQLSTATE,
        count,
        install: async () => {
            if (original !== null) throw failure("this fault handle was already provisioned; restore it instead of reinstalling")
            await withPg(connect, config, async (client) => transaction(client, async () => {
                await state(client)
                await client.query(`LOCK TABLE ${relation} IN SHARE ROW EXCLUSIVE MODE`)
                const before = await objects(client)
                if (before.functions.length !== 0 || before.triggers.length !== 0) throw failure("generated fault identity already exists")
                original = await state(client)
                await client.query(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $fault$${body}$fault$`)
                await client.query(`CREATE TRIGGER ${quoteIdent(name)} BEFORE ${operation.toUpperCase()} ON ${relation} FOR EACH ROW EXECUTE FUNCTION ${functionName}()`)
                await state(client)
                const created = await objects(client)
                owned(created)
                if (created.functions.length !== 1 || created.triggers.length !== 1 || typeof created.functions[0]?.oid !== "string" || typeof created.triggers[0]?.oid !== "string") throw failure("fault installation is incomplete")
                identities = { function: created.functions[0].oid, trigger: created.triggers[0].oid }
            }))
            if (await count() !== 2) throw failure("fault installation was not confirmed after commit")
        },
        restore: async () => {
            await withPg(connect, config, async (client) => transaction(client, async () => {
                await state(client)
                await client.query(`LOCK TABLE ${relation} IN SHARE ROW EXCLUSIVE MODE`)
                const found = await objects(client)
                owned(found)
                if (found.triggers.length !== 0) await client.query(`DROP TRIGGER ${quoteIdent(name)} ON ${relation}`)
                if (found.functions.length !== 0) await client.query(`DROP FUNCTION ${functionName}()`)
                const remaining = await objects(client)
                if (remaining.functions.length !== 0 || remaining.triggers.length !== 0) throw failure("fault removal is incomplete")
                await state(client)
            }))
            if (await count() !== 0) throw failure("fault cleanup was not confirmed after commit")
        },
    }
}
