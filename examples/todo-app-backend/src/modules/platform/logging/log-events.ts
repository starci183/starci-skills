/**
 * The closed set of event names a log line may carry. A name here is groupable forever: the variable
 * part of an observation always travels in the data object beside the name, so renaming prose never
 * silently empties a dashboard (observability's log-name law).
 */
export enum LogEvent {
    /** The recur generation tick wrote at least one occurrence during this run. */
    RECUR_GENERATION_TICK_MATERIALISED = "recur.generation-tick.materialised",
    /** An idle client in the primary pg pool died out from under the pool - the pool evicts it, so the line is observation only; the next ping still decides health on its own. */
    POSTGRESQL_PRIMARY_POOL_IDLE_CLIENT_ERROR = "postgresql-primary.pool.idle-client-error",
    /** A recur generation tick threw - the tick is fire-and-forget, so the failure is logged and the next scheduled tick retries on its own. */
    RECUR_GENERATION_TICK_FAILED = "recur.generation-tick.failed",
    /** A notify dispatch tick threw - the tick is fire-and-forget, so the failure is logged and the next interval retries on its own. */
    NOTIFY_DISPATCH_TICK_FAILED = "notify.dispatch-tick.failed",
}
