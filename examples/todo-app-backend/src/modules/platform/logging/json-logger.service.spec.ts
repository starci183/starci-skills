import { Writable } from "node:stream"
import { FakeClock } from "@starci/jest-preset/clock"
import { JsonLogger } from "./json-logger.service"

const sink = (): { stream: Writable; lines: () => Array<unknown> } => {
    const chunks: Array<string> = []
    const stream = new Writable({
        write(chunk: Buffer, _encoding, done) {
            chunks.push(chunk.toString())
            done()
        },
    })
    return { stream, lines: () => chunks.join("").split("\n").filter(Boolean).map((line): unknown => JSON.parse(line)) }
}

describe("JsonLogger", () => {
    it("stamps info lines with the clock and writes them to the out stream", () => {
        const out = sink()
        const err = sink()
        new JsonLogger(new FakeClock("2026-01-01T00:00:00.000Z"), out.stream, err.stream).info("thing.happened", { id: 1 })
        expect(out.lines()).toEqual([{ level: "info", event: "thing.happened", time: "2026-01-01T00:00:00.000Z", id: 1 }])
        expect(err.lines()).toEqual([])
    })

    it("writes warn and error lines to the err stream and serializes the cause by name and message", () => {
        const out = sink()
        const err = sink()
        const logger = new JsonLogger(new FakeClock("2026-01-01T00:00:00.000Z"), out.stream, err.stream)
        logger.warn("thing.slow")
        logger.error("thing.failed", new TypeError("boom"), { id: 2 })
        expect(err.lines()).toEqual([
            { level: "warn", event: "thing.slow", time: "2026-01-01T00:00:00.000Z" },
            { level: "error", event: "thing.failed", time: "2026-01-01T00:00:00.000Z", errorName: "TypeError", errorMessage: "boom", id: 2 },
        ])
        expect(out.lines()).toEqual([])
    })
})
