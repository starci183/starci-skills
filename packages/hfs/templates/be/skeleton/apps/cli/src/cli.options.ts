import type { DatabaseConnectionConfig } from "@modules/platform/database"

/** The parsed database configuration handed to the cli composition root. */
export interface CliAppOptions {
    /** The primary connection before its owners' entities and migrations are bound. */
    readonly database: DatabaseConnectionConfig
}

/** Passes the parsed primary connection to composition without adding registrations. */
export const createCliAppOptions = (primary: DatabaseConnectionConfig): CliAppOptions => ({
    database: primary,
})
