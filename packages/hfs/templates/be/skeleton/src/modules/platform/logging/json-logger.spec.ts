import { Writable } from "node:stream"
import { createJsonLogger } from "./json-logger"
import { LogId } from "./log-id"

const capture = () => {
    const lines: string[] = []
    const sink = new Writable({
        write(chunk: Buffer, _encoding, done) {
            lines.push(chunk.toString())
            done()
        },
    })
    return { lines, logger: createJsonLogger(sink) }
}

describe("createJsonLogger", () => {
    it("writes one JSON line carrying the level, the enum identity, a timestamp and the payload", () => {
        const { lines, logger } = capture()
        logger.error(LogId.StartupFailed, { code: "CONFIG_KEY_MISSING" })
        expect(lines).toHaveLength(1)
        expect(lines[0].endsWith("\n")).toBe(true)
        expect(JSON.parse(lines[0])).toMatchObject({ level: "error", id: "server.startup_failed", code: "CONFIG_KEY_MISSING" })
        expect(JSON.parse(lines[0]).time).toEqual(expect.any(String))
    })

    it("maps every level to its own name", () => {
        const { lines, logger } = capture()
        logger.debug(LogId.ServerStarted)
        logger.info(LogId.ServerStarted)
        logger.warn(LogId.ServerStarted)
        expect(lines.map((line) => JSON.parse(line).level)).toEqual(["debug", "info", "warn"])
    })
})
