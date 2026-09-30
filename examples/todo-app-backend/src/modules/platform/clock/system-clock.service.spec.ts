import { Test } from "@nestjs/testing"
import { SystemClock } from "./system-clock.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [SystemClock] }).compile()
    return moduleRef.get(SystemClock)
}

describe("SystemClock", () => {
    afterEach(() => {
        jest.useRealTimers()
    })

    describe("now", () => {
        it("reads the host clock", async () => {
            jest.useFakeTimers({ now: Date.parse("2026-03-04T05:06:07.000Z") })
            const clock = await build()

            expect(clock.now().toISOString()).toBe("2026-03-04T05:06:07.000Z")
        })

        it("follows the host clock as it advances", async () => {
            jest.useFakeTimers({ now: Date.parse("2026-03-04T05:06:07.000Z") })
            const clock = await build()

            jest.advanceTimersByTime(1500)

            expect(clock.now().toISOString()).toBe("2026-03-04T05:06:08.500Z")
        })
    })
})
