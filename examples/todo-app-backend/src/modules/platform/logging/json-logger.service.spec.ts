import type { Writable } from "node:stream"
import { FakeClock, mock } from "@starci/jest-preset"
import { PLATFORM_AT } from "@tests/fixtures/builders/platform.builder"
import { createJsonLogger } from "./json-logger.service"

const build = () => {
    const clock = new FakeClock(PLATFORM_AT)
    const out = mock<Writable>()
    const err = mock<Writable>()
    return { logger: createJsonLogger(clock, out, err), out, err }
}

describe("createJsonLogger", () => {
    describe("info", () => {
        it("writes one JSON line to the out stream, stamped with the clock", () => {
            const { logger, out, err } = build()

            logger.info("task.created", { taskId: "t-1" })

            expect(out.write).toHaveBeenCalledWith(`{"level":"info","event":"task.created","time":"${PLATFORM_AT}","taskId":"t-1"}\n`)
            expect(err.write).not.toHaveBeenCalled()
        })

        it("writes a line without fields", () => {
            const { logger, out } = build()

            logger.info("tick")

            expect(out.write).toHaveBeenCalledWith(`{"level":"info","event":"tick","time":"${PLATFORM_AT}"}\n`)
        })
    })

    describe("warn", () => {
        it("writes one JSON line to the err stream", () => {
            const { logger, out, err } = build()

            logger.warn("probe.failed", { dependency: "database" })

            expect(err.write).toHaveBeenCalledWith(`{"level":"warn","event":"probe.failed","time":"${PLATFORM_AT}","dependency":"database"}\n`)
            expect(out.write).not.toHaveBeenCalled()
        })
    })

    describe("error", () => {
        it("serializes an Error cause by name and message, next to the fields", () => {
            const { logger, err } = build()

            logger.error("job.failed", new TypeError("boom"), { job: "digest" })

            expect(err.write).toHaveBeenCalledWith(
                `{"level":"error","event":"job.failed","time":"${PLATFORM_AT}","errorName":"TypeError","errorMessage":"boom","job":"digest"}\n`,
            )
        })

        it("serializes a cause that is not an Error as its text", () => {
            const { logger, err } = build()

            logger.error("job.failed", "plain failure")

            expect(err.write).toHaveBeenCalledWith(`{"level":"error","event":"job.failed","time":"${PLATFORM_AT}","errorMessage":"plain failure"}\n`)
        })
    })

    describe("default streams", () => {
        afterEach(() => {
            jest.restoreAllMocks()
        })

        it("writes info to stdout and errors to stderr when no stream is handed in", () => {
            const stdout = jest.spyOn(process.stdout, "write").mockReturnValue(true)
            const stderr = jest.spyOn(process.stderr, "write").mockReturnValue(true)
            const logger = createJsonLogger(new FakeClock(PLATFORM_AT))

            logger.info("up")
            logger.warn("slow")

            expect(stdout).toHaveBeenCalledTimes(1)
            expect(stderr).toHaveBeenCalledTimes(1)
        })
    })
})
