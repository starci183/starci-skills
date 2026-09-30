import { Writable } from "node:stream"
import { FakeClock } from "@starci/jest-preset/clock"
import { JsonLoggerService } from "./json-logger.service"

interface Sink {
    stream: Writable
    lines: () => Array<string>
}

const sink = (): Sink => {
    const chunks: Array<string> = []
    const stream = new Writable({
        write(chunk: Buffer, _encoding, done) {
            chunks.push(chunk.toString())
            done()
        },
    })
    return { stream, lines: () => chunks.join("").split("
").filter(Boolean) }
}

const TIME = "2026-01-01T00:00:00.000Z"

describe("JsonLoggerService", () => {
    it("stamps info lines with the clock and writes them to the out stream", () => {
        const out = sink()
        const err = sink()
        new JsonLoggerService(new FakeClock(TIME), out.stream, err.stream).info("thing.happened", { id: 1 })
        expect(out.lines()).toEqual([JSON.stringify({ level: "info", event: "thing.happened", time: TIME, id: 1 })])
        expect(err.lines()).toEqual([])
    })

    it("writes warn and error lines to the err stream and serializes the cause by name and message", () => {
        const out = sink()
        const err = sink()
        const logger = new JsonLoggerService(new FakeClock(TIME), out.stream, err.stream)
        logger.warn("thing.slow")
        logger.error("thing.failed", new TypeError("boom"), { id: 2 })
        expect(err.lines()).toEqual([
            JSON.stringify({ level: "warn", event: "thing.slow", time: TIME }),
            JSON.stringify({ level: "error", event: "thing.failed", time: TIME, errorName: "TypeError", errorMessage: "boom", id: 2 }),
        ])
        expect(out.lines()).toEqual([])
    })
})
