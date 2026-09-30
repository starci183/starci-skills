import { SystemClock } from "./system-clock.service"

describe("SystemClock", () => {
    it("answers the current instant of the host", () => {
        const before = Date.now()
        const reading = new SystemClock().now().getTime()
        expect(reading).toBeGreaterThanOrEqual(before)
        expect(reading).toBeLessThanOrEqual(Date.now())
    })
})
