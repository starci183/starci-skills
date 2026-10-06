import type { PostgresConnectionRequest, PostgresSchemaLogin, RunPostgres } from "../contracts"
import { quoteIdent, withPg } from "../pg"
import type { PgClient, PgConfig } from "../pg"
import { randomSecret } from "./definition"
import type { ServiceDefinition, ServiceTarget } from "./definition"

const SUPERUSER = "postgres"

/** Tables that are migration ledgers and are never emptied. */
const isLedger = (table: string): boolean => /migrations/i.test(table) || table === "typeorm_metadata"

const configOf = (target: ServiceTarget, password: string, database: string): PgConfig => ({ host: target.host, port: target.port, user: SUPERUSER, password, database })

/** The stored database name of a logical database: `<namespace.snake>_<database>` (a connection's own database is named after it). */
export const databaseName = (snake: string, database: string): string => `${snake}_${database}`

/** The login role of a schema-per-context connection: `<namespace.snake>_<connection>` (roles are server-wide, so it carries the slot namespace). */
export const schemaRoleName = (snake: string, connection: string): string => `${snake}_${connection}`

/** The logical database of a connection: the one it names, or its own. */
export const logicalDatabaseOf = (connection: PostgresConnectionRequest): string => connection.database ?? connection.name

/** A SQL string literal. */
const literal = (value: string): string => `'${value.replaceAll("'", "''")}'`

/**
 * The statements that give a schema-per-context connection its schema and login inside its (already created) database: the
 * role owns the schema, its `search_path` in that database is `<schema>, public` (extensions live in `public`), and it may
 * connect and read `public`. Exposed for tests.
 */
export const schemaStatements = (database: string, schema: string, role: string): ReadonlyArray<string> => [
    `CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)} AUTHORIZATION ${quoteIdent(role)}`,
    `ALTER ROLE ${quoteIdent(role)} IN DATABASE ${quoteIdent(database)} SET search_path = ${quoteIdent(schema)}, public`,
    `GRANT CONNECT, TEMPORARY ON DATABASE ${quoteIdent(database)} TO ${quoteIdent(role)}`,
    `GRANT USAGE ON SCHEMA public TO ${quoteIdent(role)}`,
]

/** The statements that create the login role of a schema-per-context connection (a stale one of a crashed run is dropped first). */
export const roleStatements = (role: string, password: string): ReadonlyArray<string> => [
    `DROP ROLE IF EXISTS ${quoteIdent(role)}`,
    `CREATE ROLE ${quoteIdent(role)} LOGIN PASSWORD ${literal(password)}`,
]

const listTables = async (client: PgClient): Promise<ReadonlyArray<{ readonly schema: string; readonly table: string }>> => {
    const result = await client.query("SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema') AND schemaname NOT LIKE 'pg_toast%' ORDER BY schemaname, tablename")
    return result.rows.map((row) => ({ schema: String(row.schemaname), table: String(row.tablename) }))
}

/** The statements that empty one database: one connection, triggers off, per-table `TRUNCATE ... RESTART IDENTITY`. Exposed for tests. */
export const truncateStatements = (tables: ReadonlyArray<{ readonly schema: string; readonly table: string }>, keep: ReadonlyArray<string>): ReadonlyArray<{ readonly truncate: string; readonly fallback: string }> =>
    tables
        .filter(({ schema, table }) => !isLedger(table) && !keep.includes(table) && !keep.includes(`${schema}.${table}`))
        .map(({ schema, table }) => {
            const name = `${quoteIdent(schema)}.${quoteIdent(table)}`
            return { truncate: `TRUNCATE TABLE ${name} RESTART IDENTITY`, fallback: `DELETE FROM ${name}` }
        })

/**
 * Postgres: one shared superuser server per image. A connection gets a database of its own (`<namespace.snake>_<connection>`),
 * or, for a context that starts as a schema of a shared database, its schema in `<namespace.snake>_<database>` with its own
 * login role (`<namespace.snake>_<connection>`, `search_path` = the schema). The namespace is the data slot's, so every slot
 * has its own databases and roles. Reset empties a database-of-its-own connection's every schema, and only the schema of a
 * schema-per-context connection.
 */
export const postgresService: ServiceDefinition<RunPostgres> = {
    name: "postgresql",
    port: 5432,
    newSecrets: () => ({ password: randomSecret() }),
    spec: (_image, secrets) => ({
        env: { POSTGRES_USER: SUPERUSER, POSTGRES_PASSWORD: secrets.password ?? "", POSTGRES_DB: "postgres" },
        command: ["-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off", "-c", "max_connections=300"],
    }),
    ready: async (target) => {
        const result = await withPg(target.net.pg, configOf(target, target.secrets.password ?? "", "postgres"), (client) => client.query("select 1"))
        return result.rows.length === 1
    },
    provision: async (target, input) => {
        const password = target.secrets.password ?? ""
        const connections = input.request.postgresql?.connections ?? []
        const databases: Record<string, string> = {}
        const schemas: Record<string, PostgresSchemaLogin> = {}
        for (const connection of connections) {
            databases[connection.name] = databaseName(input.namespace.snake, logicalDatabaseOf(connection))
            if (connection.schema !== undefined) {
                schemas[connection.name] = { schema: connection.schema, user: schemaRoleName(input.namespace.snake, connection.name), password: randomSecret() }
            }
        }
        const stored = [...new Set(Object.values(databases))]
        await withPg(target.net.pg, configOf(target, password, "postgres"), async (admin) => {
            for (const database of stored) {
                await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(database)} WITH (FORCE)`)
                await admin.query(`CREATE DATABASE ${quoteIdent(database)}`)
            }
            for (const login of Object.values(schemas)) for (const statement of roleStatements(login.user, login.password)) await admin.query(statement)
        })
        for (const database of stored) {
            const inside = connections.filter((connection) => databases[connection.name] === database)
            const extensions = [...new Set(inside.flatMap((connection) => connection.extensions ?? []))]
            await withPg(target.net.pg, configOf(target, password, database), async (client) => {
                for (const extension of extensions) await client.query(`CREATE EXTENSION IF NOT EXISTS ${quoteIdent(extension)} SCHEMA public`)
                for (const connection of inside) {
                    const login = schemas[connection.name]
                    if (login === undefined) continue
                    for (const statement of schemaStatements(database, login.schema, login.user)) await client.query(statement)
                }
            })
        }
        return { run: { user: SUPERUSER, password, databases, schemas } }
    },
    reset: async (target, run, input) => {
        for (const [connection, database] of Object.entries(run.databases)) {
            const only = run.schemas[connection]?.schema
            await withPg(target.net.pg, configOf(target, run.password, database), async (client) => {
                await client.query("SET session_replication_role = replica")
                const tables = (await listTables(client)).filter((entry) => only === undefined || entry.schema === only)
                const statements = truncateStatements(tables, input.keepTables[connection] ?? [])
                for (const statement of statements) {
                    try {
                        await client.query(statement.truncate)
                    } catch {
                        // TRUNCATE refuses a table referenced by a foreign key of a table outside the statement; with triggers off DELETE does not enforce it.
                        await client.query(statement.fallback)
                    }
                }
            })
        }
    },
    deprovision: async (target, run) => {
        await withPg(target.net.pg, configOf(target, run.password, "postgres"), async (admin) => {
            for (const database of new Set(Object.values(run.databases))) await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(database)} WITH (FORCE)`)
            for (const login of Object.values(run.schemas)) await admin.query(`DROP ROLE IF EXISTS ${quoteIdent(login.user)}`)
        })
    },
}
