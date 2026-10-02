/**
 * The outage of one connection (one bounded context) of the shared Postgres, without the others going down:
 * - a connection with a database of its own: the database stops accepting connections (`ALLOW_CONNECTIONS false`) and every
 *   session on it is terminated;
 * - a schema-per-context connection (its schema in a database shared with other contexts): its own login role stops logging in
 *   (`NOLOGIN`) and every session of that role is terminated, so the contexts beside it in the same database keep serving.
 * That is what the context's apps see when its database host crashes; restoring lets it in again with all its data. The admin
 * work goes to the container's own port as the stack superuser, never through toxiproxy.
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

/** Takes one connection down: its own database, or the login of a schema-per-context connection. */
export const cutConnection = async (run: RunPostgres, connection: string, connect: PgConnect = realPgConnect): Promise<void> => {
    const database = databaseOf(run, connection)
    const login = run.schemas[connection]
    if (login === undefined) {
        await cutDatabase(run, database, connect)
        return
    }
    await asAdmin(run, connect, async (client) => {
        await client.query(`ALTER ROLE ${quoteIdent(login.user)} NOLOGIN`)
        await client.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = ${quoteLiteral(login.user)} AND datname = ${quoteLiteral(database)} AND pid <> pg_backend_pid()`)
    })
}

/** Brings connections back (idempotent): each database accepts connections again, each schema login logs in again. */
export const restoreConnections = async (run: RunPostgres, connections: ReadonlyArray<string>, connect: PgConnect = realPgConnect): Promise<void> => {
    const databases = connections.filter((connection) => run.schemas[connection] === undefined).map((connection) => databaseOf(run, connection))
    const logins = connections.flatMap((connection) => (run.schemas[connection] === undefined ? [] : [run.schemas[connection]?.user ?? ""]))
    if (databases.length > 0) await restoreDatabases(run, databases, connect)
    if (logins.length > 0) await asAdmin(run, connect, async (client) => {
        for (const role of logins) await client.query(`ALTER ROLE ${quoteIdent(role)} LOGIN`)
    })
}

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
