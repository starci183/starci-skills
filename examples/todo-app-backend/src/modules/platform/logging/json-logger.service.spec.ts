import type { Writable } from "node:stream"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { JsonLoggerService } from "./json-logger.service"
import { LOG_ERR, LOG_OUT } from "./logging.decorators"
import { LoggingLogEvent } from "./logging.log-events"

const AT = "2026-05-01T10:00:00.000Z"

const build = async () => {
    const out = mock<Writable>()
    const err = mock<Writable>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            JsonLoggerService,
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: LOG_OUT, useValue: out },
            { provide: LOG_ERR, useValue: err },
        ],
    }).compile()
    return { logger: moduleRef.get(JsonLoggerService), out, err }
}

/** The lines a stream received, parsed: what was logged, not how the stream was called. */
const linesOf = (stream: Writable & { write: jest.Mock }): Array<unknown> =>
    stream.write.mock.calls.map((call: Array<unknown>) => JSON.parse(String(call[0])))

describe("JsonLoggerService", () => {
    describe("info", () => {
        it("writes one JSON line to the out stream, stamped with the clock", async () => {
            const { logger, out, err } = await build()

            logger.info(LoggingLogEvent.ServerStarted, { port: 3000 })

            expect(linesOf(out)).toEqual([{ level: "info", event: "server.started", time: AT, port: 3000 }])
            expect(linesOf(err)).toEqual([])
        })

        it("ends every line with a newline and writes a line without fields", async () => {
            const { logger, out } = await build()

            logger.info(LoggingLogEvent.WorkerStarted)

            expect(String(out.write.mock.calls[0]?.[0])).toBe(`{"level":"info","event":"worker.started","time":"${AT}"}\n`)
        })
    })

    describe("warn", () => {
        it("writes one JSON line to the err stream", async () => {
            const { logger, out, err } = await build()

            logger.warn(LoggingLogEvent.ServerStarted, { dependency: "database" })

            expect(linesOf(err)).toEqual([{ level: "warn", event: "server.started", time: AT, dependency: "database" }])
            expect(linesOf(out)).toEqual([])
        })
    })

    describe("error", () => {
        it("serializes an Error cause by name and message, next to the fields", async () => {
            const { logger, err } = await build()

            logger.error(LoggingLogEvent.StartupFailed, new TypeError("boom"), { service: "todo" })

            expect(linesOf(err)).toEqual([
                { level: "error", event: "server.startup_failed", time: AT, errorName: "TypeError", errorMessage: "boom", service: "todo" },
            ])
        })

        it("serializes a cause that is not an Error as its text", async () => {
            const { logger, err } = await build()

            logger.error(LoggingLogEvent.StartupFailed, "plain failure")

            expect(linesOf(err)).toEqual([{ level: "error", event: "server.startup_failed", time: AT, errorMessage: "plain failure" }])
        })
    })
})
