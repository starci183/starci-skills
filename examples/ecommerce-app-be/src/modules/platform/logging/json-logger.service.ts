import type { Writable } from "node:stream"
import type { Clock } from "@modules/platform/clock"
import type { LogFields, Logger } from "./logging.port"

type Level = "info" | "warn" | "error"

/** The default adapter: one JSON object per line, stamped by the Clock; info goes to `out`, warn and error to `err`. */
export class JsonLoggerService implements Logger {
    constructor(
        private readonly clock: Clock,
        private readonly out: Writable,
        private readonly err: Writable,
    ) {}

    /** Writes an info line. */
    info(event: string, fields?: LogFields): void {
        this.write("info", this.out, event, fields)
    }

    /** Writes a warn line. */
    warn(event: string, fields?: LogFields): void {
        this.write("warn", this.err, event, fields)
    }

    /** Writes an error line with the cause serialized by name and message. */
    error(event: string, cause: unknown, fields?: LogFields): void {
        const detail =
            cause instanceof Error
                ? { errorName: cause.name, errorMessage: cause.message }
                : { errorMessage: String(cause) }
        this.write("error", this.err, event, { ...detail, ...fields })
    }

    private write(level: Level, sink: Writable, event: string, fields?: LogFields): void {
        sink.write(`${JSON.stringify({ level, event, time: this.clock.now().toISOString(), ...fields })}\n`)
    }
}

/** Builds the JSON logger stamping lines with `clock` on stdout and stderr; main.ts uses it before the DI container exists. */
export const createJsonLogger = (clock: Clock): Logger => new JsonLoggerService(clock, process.stdout, process.stderr)
