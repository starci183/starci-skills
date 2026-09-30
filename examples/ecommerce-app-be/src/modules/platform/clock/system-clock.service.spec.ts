import { Test } from "@nestjs/testing"
import { SystemClockService } from "./system-clock.service"

describe("SystemClockService", () => {
    afterEach(() => {
        jest.useRealTimers()
    })

    it("returns the current instant of the host clock", async () => {
        jest.useFakeTimers({ now: new Date("2026-03-04T05:06:07.000Z") })
        const moduleRef = await Test.createTestingModule({ providers: [SystemClockService] }).compile()

        const now = moduleRef.get(SystemClockService).now()

        expect(now.toISOString()).toBe("2026-03-04T05:06:07.000Z")
    })
})
