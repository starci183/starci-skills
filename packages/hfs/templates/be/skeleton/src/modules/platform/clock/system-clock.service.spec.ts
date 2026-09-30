import { Test } from "@nestjs/testing"
import { SystemClockService } from "./system-clock.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [SystemClockService] }).compile()
    return { service: moduleRef.get(SystemClockService) }
}

describe("SystemClockService", () => {
    describe("now", () => {
        it("answers the current instant of the host, a valid date", async () => {
            const { service } = await build()

            const instant = service.now()

            expect(instant).toBeInstanceOf(Date)
            expect(Number.isNaN(instant.getTime())).toBe(false)
        })
    })
})
