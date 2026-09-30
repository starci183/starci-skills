import { Test } from "@nestjs/testing"
import { FakeClock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { JsonLoggerService, createJsonLogger } from "./json-logger.service"

const TIME = "2026-01-01T00:00:00.000Z"

const build = async () => {
    const clock = new FakeClock(TIME)
    const moduleRef = await Test.createTestingModule({
        providers: [JsonLoggerService, { provide: CLOCK, useValue: clock }],
    }).compile()
    return { service: moduleRef.get(JsonLoggerService), clock }
}

/** One JSON line, the way the logger writes it. */
const line = (fields: Record<string, unknown>): string => `${JSON.stringify(fields)}\n`

describe("JsonLoggerService", () => {
    const stdout: Array<string> = []
    const stderr: Array<string> = []

    beforeEach(() => {
        stdout.length = 0
        stderr.length = 0
        jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
            stdout.push(String(chunk))
            return true
        })
        jest.spyOn(process.stderr, "write").mockImplementation((chunk) => {
            stderr.push(String(chunk))
            return true
        })
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe("info", () => {
        it("stamps the line with the clock and writes it to stdout", async () => {
            const { service } = await build()

            service.info("thing.happened", { id: 1 })

            expect(stdout).toEqual([line({ level: "info", event: "thing.happened", time: TIME, id: 1 })])
            expect(stderr).toEqual([])
        })
    })

    describe("warn", () => {
        it("writes the line to stderr, stamped with the moment of the call", async () => {
            const { service, clock } = await build()
            clock.advance(5_000)

            service.warn("thing.slow")

            expect(stderr).toEqual([line({ level: "warn", event: "thing.slow", time: "2026-01-01T00:00:05.000Z" })])
            expect(stdout).toEqual([])
        })
    })

    describe("error", () => {
        it("serializes an Error cause by name and message", async () => {
            const { service } = await build()

            service.error("thing.failed", new TypeError("boom"), { id: 2 })

            expect(stderr).toEqual([
                line({
                    level: "error",
                    event: "thing.failed",
                    time: TIME,
                    errorName: "TypeError",
                    errorMessage: "boom",
                    id: 2,
                }),
            ])
        })

        it("serializes a cause that is not an Error to its text", async () => {
            const { service } = await build()

            service.error("thing.failed", "plain text")

            expect(stderr).toEqual([
                line({ level: "error", event: "thing.failed", time: TIME, errorMessage: "plain text" }),
            ])
        })
    })

    describe("createJsonLogger", () => {
        it("builds a logger stamped by the given clock", () => {
            createJsonLogger(new FakeClock(TIME)).info("thing.started")

            expect(stdout).toEqual([line({ level: "info", event: "thing.started", time: TIME })])
        })
    })
})
