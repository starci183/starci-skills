import { Test } from "@nestjs/testing"
import { SystemClock } from "./system-clock.service"

describe("SystemClock", () => {
    afterEach(() => {
        jest.useRealTimers()
    })

    it("returns the current instant of the host clock", async () => {
        jest.useFakeTimers({ now: new Date("2026-03-04T05:06:07.000Z") })
        const moduleRef = await Test.createTestingModule({ providers: [SystemClock] }).compile()

        const now = moduleRef.get(SystemClock).now()

        expect(now.toISOString()).toBe("2026-03-04T05:06:07.000Z")
    })
})
