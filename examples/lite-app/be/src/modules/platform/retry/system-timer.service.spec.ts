import { Test } from "@nestjs/testing"
import { SystemTimerService } from "./system-timer.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [SystemTimerService] }).compile()
    return moduleRef.get(SystemTimerService)
}

describe("SystemTimerService", () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it("runs a callback when its delay expires", async () => {
        const service = await build()
        const callback = jest.fn()

        service.schedule(callback, 1000)
        await jest.advanceTimersByTimeAsync(999)
        expect(callback).not.toHaveBeenCalled()
        await jest.advanceTimersByTimeAsync(1)
        expect(callback).toHaveBeenCalledTimes(1)
        expect(jest.getTimerCount()).toBe(0)
    })

    it("cancels a scheduled callback", async () => {
        const service = await build()
        const callback = jest.fn()
        const cancel = service.schedule(callback, 1000)

        cancel()
        await jest.advanceTimersByTimeAsync(1000)

        expect(callback).not.toHaveBeenCalled()
        expect(jest.getTimerCount()).toBe(0)
    })
})
