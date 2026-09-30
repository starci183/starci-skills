/** The structured data of one log line; values are plain data, never a request, a token or a secret. */
export interface LogFields {
    /** The value logged under `name`. */
    readonly [name: string]: unknown
}

/** The logging port: owners log through it with an enum member of their own `<owner>.log-events.ts`, never `console`. */
export interface Logger {
    /** A normal event worth keeping. */
    info(event: string, fields?: LogFields): void
    /** Something unexpected the service recovered from. */
    warn(event: string, fields?: LogFields): void
    /** A failure: the cause is serialized by name and message, never dumped whole. */
    error(event: string, cause: unknown, fields?: LogFields): void
}
