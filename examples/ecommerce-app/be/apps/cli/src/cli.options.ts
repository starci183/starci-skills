import type { OrderExpiryTicksOptions } from "@modules/domain/order-expiry-ticks"
import type { DatabaseConnectionOptions } from "@modules/platform/database"

/** The CLI's composed migration options, also used by the test world's migration runner. */
export interface CliAppOptions {
    /** The connections the migrate command migrates, in the order it runs them. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
    /** The manual expiry tick uses the scheduler's payment window. */
    readonly orderExpiry: OrderExpiryTicksOptions
}

// Preserve the migration runner's public import while composition belongs to the app root.
export { createCliAppOptions } from "./app.module"
