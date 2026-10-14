import { withOperationDeadline } from "./operation-deadline.policy"

describe("withOperationDeadline", () => {
    afterEach(() => jest.useRealTimers())

    it("returns the dependency result and removes the response deadline", async () => {
        jest.useFakeTimers()

        await expect(withOperationDeadline(Promise.resolve("ready"), 1000)).resolves.toBe("ready")

        expect(jest.getTimerCount()).toBe(0)
    })

    it("preserves a dependency failure and removes its timer", async () => {
        jest.useFakeTimers()
        const error = new Error("dependency unavailable")

        await expect(withOperationDeadline(Promise.reject(error), 1000)).rejects.toBe(error)

        expect(jest.getTimerCount()).toBe(0)
    })

    it("expires when the dependency never responds", async () => {
        jest.useFakeTimers()
        const result = expect(withOperationDeadline(new Promise(() => {}), 1000)).rejects.toBeUndefined()

        await jest.advanceTimersByTimeAsync(1000)

        await result
        expect(jest.getTimerCount()).toBe(0)
    })
})
