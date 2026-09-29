import type {
    Writable
} from "node:stream"
import type {
    Clock
} from "ecommerce-app-be/modules/platform/clock"
import type {
    LogId
} from "./log-id"
import {
    Logger, LogPayload
} from "./logger.port"

type Level = "debug" | "info" | "warn" | "error"

/** The default adapter: one JSON object per line on a stream, so a collector reads it without parsing prose. */
class JsonLogger extends Logger {
    constructor(private readonly clock: Clock, private readonly sink: Writable) {
        super()
    }

    debug(id: LogId, payload?: LogPayload): void {
        this.write("debug",
            id,
            payload)
    }

    info(id: LogId, payload?: LogPayload): void {
        this.write("info",
            id,
            payload)
    }

    warn(id: LogId, payload?: LogPayload): void {
        this.write("warn",
            id,
            payload)
    }

    error(id: LogId, payload?: LogPayload): void {
        this.write("error",
            id,
            payload)
    }

    private write(level: Level, id: LogId, payload?: LogPayload): void {
        this.sink.write(`${JSON.stringify({
            level, id, time: this.clock.now().toISOString(), ...payload
        })}\n`)
    }
}

/** Builds the JSON logger stamping lines with `clock`; `sink` is stdout unless a caller (a spec, a process manager) supplies its own stream. */
export const createJsonLogger = (clock: Clock, sink: Writable = process.stdout): Logger => new JsonLogger(clock,
    sink)
