/** The slice of a `pg` client the stack uses; `pg` is a peer dependency loaded lazily, so tests inject a scripted one. */
export interface PgClient {
    connect(): Promise<void>
    query(text: string): Promise<{ readonly rows: ReadonlyArray<Record<string, unknown>> }>
    end(): Promise<void>
    on(event: "error", listener: (error: unknown) => void): unknown
}

/** How to reach one database. */
export interface PgConfig {
    readonly host: string
    readonly port: number
    readonly user: string
    readonly password: string
    readonly database: string
}

/** Builds a (not yet connected) client. */
export type PgConnect = (config: PgConfig) => PgClient

interface PgModule {
    readonly Client: new (config: Record<string, unknown>) => PgClient
}

/** The real {@link PgConnect}: the `pg` peer dependency, required on first use. */
export const realPgConnect: PgConnect = (config) => {
    const loaded: unknown = require("pg")
    const module = loaded as PgModule
    return new module.Client({ ...config, connectionTimeoutMillis: 5000 })
}

/** Connects, runs `work`, and always ends the client. */
export const withPg = async <T>(connect: PgConnect, config: PgConfig, work: (client: PgClient) => Promise<T>): Promise<T> => {
    const client = connect(config)
    client.on("error", () => undefined)
    await client.connect()
    try {
        return await work(client)
    } finally {
        await client.end().catch(() => undefined)
    }
}

/** A double-quoted SQL identifier. */
export const quoteIdent = (name: string): string => `"${name.replaceAll('"', '""')}"`
