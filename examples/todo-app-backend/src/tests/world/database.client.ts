/**
 * The world's admin door to the REAL Postgres of the stack: one database per run inside the shared (possibly warm)
 * instance, created before the migration and dropped at teardown, so a warm stack never carries a run's data into the next.
 * The credentials are the ones the stack declares for the service; the ports come from the stack, never from source.
 */
import { Client } from "pg"
import { portOf, serviceOf } from "./stack.client"
import type { TestStack } from "./stack.client"

const ADMIN_DATABASE = "postgres"
const SERVICE = "postgres"

/** The connection URL of `database` on the stack's Postgres; `proxied` goes through the toxiproxy proxy (the apps under test). */
export const databaseUrlOf = (stack: TestStack, database: string, proxied: boolean): string => {
    const service = serviceOf(stack, SERVICE)
    const port = portOf(service)
    const user = encodeURIComponent(service.environment.POSTGRES_USER ?? "postgres")
    const password = service.environment.POSTGRES_PASSWORD
    const credentials = password === undefined || password === "" ? user : `${user}:${encodeURIComponent(password)}`
    return `postgres://${credentials}@${port.host}:${proxied ? port.proxy : port.direct}/${database}`
}

const withAdmin = async <T>(stack: TestStack, act: (client: Client) => Promise<T>): Promise<T> => {
    const client = new Client({ connectionString: databaseUrlOf(stack, ADMIN_DATABASE, false) })
    await client.connect()
    try {
        return await act(client)
    } finally {
        await client.end()
    }
}

const quoted = (name: string): string => `"${name.replaceAll('"', '""')}"`

/** Creates the run's database. */
export const createDatabase = (stack: TestStack, database: string): Promise<void> =>
    withAdmin(stack, async (client) => {
        await client.query(`CREATE DATABASE ${quoted(database)}`)
    })

/** Drops the run's database, kicking out any connection still open; absent is fine. */
export const dropDatabase = (stack: TestStack, database: string): Promise<void> =>
    withAdmin(stack, async (client) => {
        await client.query(`DROP DATABASE IF EXISTS ${quoted(database)} WITH (FORCE)`)
    })

/** True while the instance still holds the database. */
export const databaseExists = (stack: TestStack, database: string): Promise<boolean> =>
    withAdmin(stack, async (client) => {
        const found = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database])
        return found.rowCount === 1
    })
