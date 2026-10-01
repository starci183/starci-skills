import type { RunPostgres } from "../contracts"
import { quoteIdent, withPg } from "../pg"
import type { PgClient, PgConfig } from "../pg"
import { randomSecret } from "./definition"
import type { ServiceDefinition, ServiceTarget } from "./definition"

const SUPERUSER = "postgres"

/** Tables that are migration ledgers and are never emptied. */
const isLedger = (table: string): boolean => /migrations/i.test(table) || table === "typeorm_metadata"

const configOf = (target: ServiceTarget, password: string, database: string): PgConfig => ({ host: target.host, port: target.port, user: SUPERUSER, password, database })

/** The stored database name of a connection: `<namespace.snake>_<connection>`. */
export const databaseName = (snake: string, connection: string): string => `${snake}_${connection}`

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

/** Postgres: one shared superuser server per image; one database per connection of the namespace. */
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
        await withPg(target.net.pg, configOf(target, password, "postgres"), async (admin) => {
            for (const connection of connections) {
                const database = databaseName(input.namespace.snake, connection.name)
                databases[connection.name] = database
                await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(database)} WITH (FORCE)`)
                await admin.query(`CREATE DATABASE ${quoteIdent(database)}`)
            }
        })
        for (const connection of connections) {
            const extensions = connection.extensions ?? []
            if (extensions.length === 0) continue
            await withPg(target.net.pg, configOf(target, password, databases[connection.name] ?? ""), async (client) => {
                for (const extension of extensions) await client.query(`CREATE EXTENSION IF NOT EXISTS ${quoteIdent(extension)}`)
            })
        }
        return { run: { user: SUPERUSER, password, databases } }
    },
    reset: async (target, run, input) => {
        for (const [connection, database] of Object.entries(run.databases)) {
            await withPg(target.net.pg, configOf(target, run.password, database), async (client) => {
                await client.query("SET session_replication_role = replica")
                const statements = truncateStatements(await listTables(client), input.keepTables[connection] ?? [])
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
            for (const database of Object.values(run.databases)) await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(database)} WITH (FORCE)`)
        })
    },
}
