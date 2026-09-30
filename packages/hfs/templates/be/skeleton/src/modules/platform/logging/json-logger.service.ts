import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { LogFields, Logger } from "./logging.port"

type Level = "info" | "warn" | "error"

@Injectable()
/** The default adapter: one JSON object per line, stamped by the Clock; info goes to stdout, warn and error to stderr. */
export class JsonLoggerService implements Logger {
    constructor(@InjectClock() private readonly clock: Clock) {}

    /** Writes an info line. */
    info(event: string, fields?: LogFields): void {
        this.write("info", process.stdout, event, fields)
    }

    /** Writes a warn line. */
    warn(event: string, fields?: LogFields): void {
        this.write("warn", process.stderr, event, fields)
    }

    /** Writes an error line with the cause serialized by name and message. */
    error(event: string, cause: unknown, fields?: LogFields): void {
        const detail =
            cause instanceof Error
                ? { errorName: cause.name, errorMessage: cause.message }
                : { errorMessage: String(cause) }
        this.write("error", process.stderr, event, { ...detail, ...fields })
    }

    private write(level: Level, sink: NodeJS.WriteStream, event: string, fields?: LogFields): void {
        sink.write(`${JSON.stringify({ level, event, time: this.clock.now().toISOString(), ...fields })}\n`)
    }
}

/** Builds the JSON logger stamping lines with `clock`; main.ts uses it before the DI container exists. */
export const createJsonLogger = (clock: Clock): Logger => new JsonLoggerService(clock)
