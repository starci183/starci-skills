import {
    Writable 
} from "node:stream"
import {
    FakeClock 
} from "@starci/jest-preset/clock"
import {
    createJsonLogger 
} from "./json-logger"
import {
    LogId 
} from "./log-id"

function capture(): { lines: Array<string>; logger: ReturnType<typeof createJsonLogger> } {
    const lines: Array<string> = []
    const sink = new Writable({
        write(chunk: Buffer, _encoding, done) {
            lines.push(chunk.toString())
            done()
        },
    })
    return {
        lines, logger: createJsonLogger(new FakeClock("2026-03-01T08:00:00.000Z"),
            sink) 
    }
}

describe("createJsonLogger",
    () => {
        it("writes one JSON line carrying the level, the enum identity, the clock's time and the payload",
            () => {
                const { lines, logger } = capture()

                logger.error(LogId.StartupFailed,
                    {
                        code: "METADATA_FILE_MISSING" 
                    })

                expect(lines).toHaveLength(1)
                expect(lines[0].endsWith("\n")).toBe(true)
                expect(JSON.parse(lines[0])).toEqual({
                    level: "error",
                    id: "server.startup_failed",
                    time: "2026-03-01T08:00:00.000Z",
                    code: "METADATA_FILE_MISSING",
                })
            })

        it("maps every level to its own name",
            () => {
                const { lines, logger } = capture()

                logger.debug(LogId.ServerStarted)
                logger.info(LogId.ServerStarted)
                logger.warn(LogId.ServerStarted)

                expect(lines.map((line) => JSON.parse(line).level)).toEqual(["debug",
                    "info",
                    "warn"])
            })
    })
