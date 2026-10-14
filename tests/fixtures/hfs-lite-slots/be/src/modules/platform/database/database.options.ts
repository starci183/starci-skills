import type { Secret } from "@modules/platform/config"

/** A named connection to Supabase's PostgreSQL server, owned by the api app. */
export interface DatabaseConnectionOptions {
    readonly name: "primary"
    readonly provider: "supabase"
    readonly url: Secret
    readonly schema: string
}

/** The app or test composition supplies its declared connections once. */
export interface DatabaseOptions {
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
}
