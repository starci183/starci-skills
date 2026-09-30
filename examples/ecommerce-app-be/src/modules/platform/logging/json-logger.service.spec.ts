import type { Writable } from "node:stream"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Test } from "@nestjs/testing"
import { JsonLoggerService } from "./json-logger.service"
import { LOG_ERR, LOG_OUT } from "./logging.decorators"

describe("JsonLoggerService", () => {
    const build = async () => {
        const clock = new FakeClock("2026-05-06T07:08:09.000Z")
        const out = mock<Writable>()
        const err = mock<Writable>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                JsonLoggerService,
                { provide: CLOCK, useValue: clock },
                { provide: LOG_OUT, useValue: out },
                { provide: LOG_ERR, useValue: err },
            ],
        }).compile()
        return { logger: moduleRef.get(JsonLoggerService), clock, out, err }
    }

    it("writes an info line to the out stream stamped by the clock", async () => {
        const { logger, out, err } = await build()

        logger.info("cart.opened", { personId: "p-1" })

        expect(out.write).toHaveBeenCalledWith(
            `${JSON.stringify({ level: "info", event: "cart.opened", time: "2026-05-06T07:08:09.000Z", personId: "p-1" })}\n`,
        )
        expect(err.write).not.toHaveBeenCalled()
    })

    it("writes a warn line without fields to the err stream", async () => {
        const { logger, clock, out, err } = await build()
        clock.advance(1000)

        logger.warn("cache.slow")

        expect(err.write).toHaveBeenCalledWith(
            `${JSON.stringify({ level: "warn", event: "cache.slow", time: "2026-05-06T07:08:10.000Z" })}\n`,
        )
        expect(out.write).not.toHaveBeenCalled()
    })

    it("writes an error line with the name and message of an Error cause", async () => {
        const { logger, err } = await build()

        logger.error("db.failed", new TypeError("boom"), { operation: "PlaceOrderHandler" })

        expect(err.write).toHaveBeenCalledWith(
            `${JSON.stringify({
                level: "error",
                event: "db.failed",
                time: "2026-05-06T07:08:09.000Z",
                errorName: "TypeError",
                errorMessage: "boom",
                operation: "PlaceOrderHandler",
            })}\n`,
        )
    })

    it("writes an error line with the text of a cause that is not an Error", async () => {
        const { logger, err } = await build()

        logger.error("db.failed", "plain failure")

        expect(err.write).toHaveBeenCalledWith(
            `${JSON.stringify({ level: "error", event: "db.failed", time: "2026-05-06T07:08:09.000Z", errorMessage: "plain failure" })}\n`,
        )
    })
})
