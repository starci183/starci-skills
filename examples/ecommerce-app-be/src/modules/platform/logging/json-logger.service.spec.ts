import type { Writable } from "node:stream"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Test } from "@nestjs/testing"
import { createJsonLogger, JsonLoggerService } from "./json-logger.service"
import { LOG_ERR, LOG_OUT } from "./logging.decorators"

const build = async () => {
    const clock = new FakeClock("2026-05-06T07:08:09.000Z")
    const written: Array<{ stream: "out" | "err"; line: string }> = []
    const out = mock<Writable>({
        write: (chunk: string) => {
            written.push({ stream: "out", line: chunk })
            return true
        },
    })
    const err = mock<Writable>({
        write: (chunk: string) => {
            written.push({ stream: "err", line: chunk })
            return true
        },
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            JsonLoggerService,
            { provide: CLOCK, useValue: clock },
            { provide: LOG_OUT, useValue: out },
            { provide: LOG_ERR, useValue: err },
        ],
    }).compile()
    return { logger: moduleRef.get(JsonLoggerService), clock, written }
}

describe("JsonLoggerService", () => {
    it("writes an info line to the out stream stamped by the clock", async () => {
        const { logger, written } = await build()

        logger.info("cart.opened", { personId: "p-1" })

        expect(written).toEqual([
            {
                stream: "out",
                line: `${JSON.stringify({ level: "info", event: "cart.opened", time: "2026-05-06T07:08:09.000Z", personId: "p-1" })}\n`,
            },
        ])
    })

    it("writes a warn line without fields to the err stream", async () => {
        const { logger, clock, written } = await build()
        clock.advance(1000)

        logger.warn("cache.slow")

        expect(written).toEqual([
            {
                stream: "err",
                line: `${JSON.stringify({ level: "warn", event: "cache.slow", time: "2026-05-06T07:08:10.000Z" })}\n`,
            },
        ])
    })

    it("writes an error line with the name and message of an Error cause", async () => {
        const { logger, written } = await build()

        logger.error("db.failed", new TypeError("boom"), { operation: "PlaceOrderHandler" })

        expect(written).toEqual([
            {
                stream: "err",
                line: `${JSON.stringify({
                    level: "error",
                    event: "db.failed",
                    time: "2026-05-06T07:08:09.000Z",
                    errorName: "TypeError",
                    errorMessage: "boom",
                    operation: "PlaceOrderHandler",
                })}\n`,
            },
        ])
    })

    it("writes an error line with the text of a cause that is not an Error", async () => {
        const { logger, written } = await build()

        logger.error("db.failed", "plain failure")

        expect(written).toEqual([
            {
                stream: "err",
                line: `${JSON.stringify({ level: "error", event: "db.failed", time: "2026-05-06T07:08:09.000Z", errorMessage: "plain failure" })}\n`,
            },
        ])
    })

    describe("createJsonLogger", () => {
        afterEach(() => {
            jest.restoreAllMocks()
        })

        it("builds a logger that writes info to stdout and errors to stderr, stamped by the clock", () => {
            const lines: Array<string> = []
            jest.spyOn(process.stdout, "write").mockImplementation((chunk) => lines.push(`out:${String(chunk)}`) > 0)
            jest.spyOn(process.stderr, "write").mockImplementation((chunk) => lines.push(`err:${String(chunk)}`) > 0)
            const logger = createJsonLogger(new FakeClock("2026-05-06T07:08:09.000Z"))

            logger.info("server.started")
            logger.warn("cache.slow")

            expect(lines).toEqual([
                `out:${JSON.stringify({ level: "info", event: "server.started", time: "2026-05-06T07:08:09.000Z" })}\n`,
                `err:${JSON.stringify({ level: "warn", event: "cache.slow", time: "2026-05-06T07:08:09.000Z" })}\n`,
            ])
        })
    })
})
