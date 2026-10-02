import type { Secret } from "@modules/platform/config"

/** What the primary connection parser reads from the environment. */
export interface DatabaseConnectionConfig {
    /** The logical connection name declared in `hfs.json`. */
    readonly name: string
    /** The Supabase PostgreSQL provider; schema changes remain under `supabase/migrations`. */
    readonly provider: "supabase"
    /** The dedicated least-privilege application role's connection URL. */
    readonly url: Secret
}

/** Runtime connection options add only the isolated PostgreSQL schema; lite has no entity or migration registry. */
export interface DatabaseConnectionOptions extends DatabaseConnectionConfig {
    /** The schema named by the `hfs.json` isolation contract. */
    readonly schema?: string
}

/** Options of the database capability. */
export interface DatabaseOptions {
    /** The connections this app opens; one per physical database. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
}
