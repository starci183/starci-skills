import { Test } from "@nestjs/testing"
import { DeadlineSchedulerService } from "./deadline-scheduler.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [DeadlineSchedulerService] }).compile()
    return moduleRef.get(DeadlineSchedulerService)
}

describe("DeadlineSchedulerService", () => {
    afterEach(() => jest.useRealTimers())

    it("returns the dependency result and removes the response deadline", async () => {
        const subject = await build()
        jest.useFakeTimers()

        await expect(subject.run(Promise.resolve("ready"), 1000)).resolves.toBe("ready")

        expect(jest.getTimerCount()).toBe(0)
    })

    it("preserves a dependency failure and removes its timer", async () => {
        const subject = await build()
        jest.useFakeTimers()
        const error = new Error("dependency unavailable")

        await expect(subject.run(Promise.reject(error), 1000)).rejects.toBe(error)

        expect(jest.getTimerCount()).toBe(0)
    })

    it("expires when the dependency never responds", async () => {
        const subject = await build()
        jest.useFakeTimers()
        const result = expect(subject.run(new Promise(() => {}), 1000)).rejects.toBeUndefined()

        await jest.advanceTimersByTimeAsync(1000)

        await result
        expect(jest.getTimerCount()).toBe(0)
    })
})
