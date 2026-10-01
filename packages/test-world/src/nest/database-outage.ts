/**
 * The outage of one database connection of the shared Postgres. The repository's connections are separate databases in one
 * shared container (`<namespace.snake>_<connection>`), so one of them goes down without the others: the database stops
 * accepting connections (`ALLOW_CONNECTIONS false`) and every session on it is terminated, which is what its apps see when
 * its host crashes; restoring lets it accept connections again with all its data. The admin work goes to the container's own
 * port as the stack superuser, never through toxiproxy.
 */
import { TestWorldErrorCode, worldError } from "../errors"
import { quoteIdent, realPgConnect, withPg } from "../stack/pg"
import type { PgClient, PgConnect } from "../stack/pg"
import type { RunPostgres } from "../stack/contracts"

/** The maintenance database the admin session connects to (never one of the repository's own). */
const ADMIN_DATABASE = "postgres"

/** The stored database name of a declared connection; an undeclared one is a world failure. */
export const databaseOf = (run: RunPostgres, connection: string): string => {
    const database = run.databases[connection]
    if (database === undefined) {
        throw worldError(TestWorldErrorCode.NotDeclared, `infra.postgresql.connection(${connection}) is not a declared connection (${Object.keys(run.databases).join(", ")})`)
    }
    return database
}

/** A SQL string literal. */
const quoteLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`

const asAdmin = <T>(run: RunPostgres, connect: PgConnect, work: (client: PgClient) => Promise<T>): Promise<T> =>
    withPg(connect, { host: "127.0.0.1", port: run.directPort, user: run.user, password: run.password, database: ADMIN_DATABASE }, work)

/** Takes one database down: no new connection is accepted, every live session on it is terminated. */
export const cutDatabase = (run: RunPostgres, database: string, connect: PgConnect = realPgConnect): Promise<void> =>
    asAdmin(run, connect, async (client) => {
        await client.query(`ALTER DATABASE ${quoteIdent(database)} ALLOW_CONNECTIONS false`)
        await client.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${quoteLiteral(database)} AND pid <> pg_backend_pid()`)
    })

/** Brings databases back: each accepts connections again (idempotent: a database that never went down is unchanged). */
export const restoreDatabases = (run: RunPostgres, databases: ReadonlyArray<string>, connect: PgConnect = realPgConnect): Promise<void> =>
    asAdmin(run, connect, async (client) => {
        for (const database of databases) await client.query(`ALTER DATABASE ${quoteIdent(database)} ALLOW_CONNECTIONS true`)
    })
