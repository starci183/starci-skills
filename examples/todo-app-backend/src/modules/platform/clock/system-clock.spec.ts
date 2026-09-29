import {
    SystemClock 
} from "./system-clock"

describe("SystemClock",
    () => {
        it("returns the host time as a fresh Date on every call",
            () => {
                const clock = new SystemClock()
                const before = Date.now()
                const first = clock.now()
                const second = clock.now()

                expect(first).toBeInstanceOf(Date)
                expect(first.getTime()).toBeGreaterThanOrEqual(before)
                expect(second.getTime()).toBeGreaterThanOrEqual(first.getTime())
                expect(second).not.toBe(first)
            })
    })
