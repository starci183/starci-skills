import type { Writable } from "node:stream"
import type { Clock } from "@modules/platform/clock"
import type { LogFields, Logger } from "./logging.port"

type Level = "info" | "warn" | "error"

/**
 * Builds the default adapter: one JSON object per line, stamped by `clock`; info goes to `out`, warn and error to `err`
 * (stdout and stderr unless a test hands in its own streams). main.ts uses it before the DI container exists.
 */
export const createJsonLogger = (clock: Clock, out: Writable = process.stdout, err: Writable = process.stderr): Logger => {
    const write = (level: Level, sink: Writable, event: string, fields?: LogFields): void => {
        sink.write(`${JSON.stringify({ level, event, time: clock.now().toISOString(), ...fields })}\n`)
    }
    return {
        info: (event, fields) => {
            write("info", out, event, fields)
        },
        warn: (event, fields) => {
            write("warn", err, event, fields)
        },
        error: (event, cause, fields) => {
            const detail = cause instanceof Error ? { errorName: cause.name, errorMessage: cause.message } : { errorMessage: String(cause) }
            write("error", err, event, { ...detail, ...fields })
        },
    }
}
