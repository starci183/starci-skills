import type { LogId } from "./log-id"

/** The structured data of one log line; values are plain data, never a request, a token or a secret. */
export type LogPayload = Readonly<Record<string, unknown>>

/** The logging port: capabilities log through it with an enum identity and a structured payload, never `console`. */
export abstract class Logger {
    /** Detail for people debugging one environment. */
    abstract debug(id: LogId, payload?: LogPayload): void

    /** A normal event worth keeping. */
    abstract info(id: LogId, payload?: LogPayload): void

    /** Something unexpected the app recovered from. */
    abstract warn(id: LogId, payload?: LogPayload): void

    /** A failure the app could not recover from in place. */
    abstract error(id: LogId, payload?: LogPayload): void
}
