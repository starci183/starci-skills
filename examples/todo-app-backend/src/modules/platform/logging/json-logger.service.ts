import type { Writable } from "node:stream"
import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogErr, InjectLogOut } from "./logging.decorators"
import type { LogFields, Logger } from "./logging.port"

type Level = "info" | "warn" | "error"

@Injectable()
/**
 * The default Logger adapter: one JSON object per line, stamped by the clock; info goes to the out stream, warn and error
 * to the err stream (stdout and stderr in the apps). main.ts builds it directly before the DI container exists.
 */
export class JsonLoggerService implements Logger {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogOut() private readonly out: Writable,
        @InjectLogErr() private readonly err: Writable,
    ) {}

    /** A normal event worth keeping. */
    info(event: string, fields?: LogFields): void {
        this.write("info", this.out, event, fields)
    }

    /** Something unexpected the service recovered from. */
    warn(event: string, fields?: LogFields): void {
        this.write("warn", this.err, event, fields)
    }

    /** A failure: the cause is serialized by name and message, never dumped whole. */
    error(event: string, cause: unknown, fields?: LogFields): void {
        const detail = cause instanceof Error ? { errorName: cause.name, errorMessage: cause.message } : { errorMessage: String(cause) }
        this.write("error", this.err, event, { ...detail, ...fields })
    }

    private write(level: Level, sink: Writable, event: string, fields?: LogFields): void {
        sink.write(`${JSON.stringify({ level, event, time: this.clock.now().toISOString(), ...fields })}\n`)
    }
}
