import { Writable } from "node:stream"
import { FakeClock } from "@starci/jest-preset/clock"
import { createJsonLogger } from "./json-logger.service"
import { LoggingLogEvent } from "./logging.log-events"

interface Sink {
    readonly stream: Writable
    lines(): Array<unknown>
}

const parseLine = (line: string): unknown => {
    try {
        return JSON.parse(line)
    } catch (error) {
        return error
    }
}

const sink = (): Sink => {
    const chunks: Array<string> = []
    const stream = new Writable({
        write(chunk: Buffer, _encoding, done) {
            chunks.push(chunk.toString())
            done()
        },
    })
    return { stream, lines: () => chunks.join("").split("\n").filter(Boolean).map(parseLine) }
}

describe("createJsonLogger", () => {
    it("stamps info lines with the clock and writes them to the out stream", () => {
        const out = sink()
        const err = sink()
        createJsonLogger(new FakeClock("2026-01-01T00:00:00.000Z"), out.stream, err.stream).info(LoggingLogEvent.ServerStarted, { id: 1 })
        expect(out.lines()).toEqual([{ level: "info", event: LoggingLogEvent.ServerStarted, time: "2026-01-01T00:00:00.000Z", id: 1 }])
        expect(err.lines()).toEqual([])
    })

    it("writes warn and error lines to the err stream and serializes the cause by name and message", () => {
        const out = sink()
        const err = sink()
        const logger = createJsonLogger(new FakeClock("2026-01-01T00:00:00.000Z"), out.stream, err.stream)
        logger.warn(LoggingLogEvent.WorkerStarted)
        logger.error(LoggingLogEvent.StartupFailed, new TypeError("boom"), { id: 2 })
        expect(err.lines()).toEqual([
            { level: "warn", event: LoggingLogEvent.WorkerStarted, time: "2026-01-01T00:00:00.000Z" },
            { level: "error", event: LoggingLogEvent.StartupFailed, time: "2026-01-01T00:00:00.000Z", errorName: "TypeError", errorMessage: "boom", id: 2 },
        ])
        expect(out.lines()).toEqual([])
    })
})
