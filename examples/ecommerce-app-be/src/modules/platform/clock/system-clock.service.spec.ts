import { SystemClockService } from "./system-clock.service"

describe("SystemClockService", () => {
    it("answers the current instant of the host", () => {
        const before = Date.now()
        const reading = new SystemClockService().now().getTime()
        expect(reading).toBeGreaterThanOrEqual(before)
        expect(reading).toBeLessThanOrEqual(Date.now())
    })
})
