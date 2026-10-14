import { HttpError, HttpErrorCode } from "./errors/http.error"
import { withinDeadline } from "./operation-deadline.policy"

describe("withinDeadline", () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it("returns a completed answer and clears its deadline", async () => {
        await expect(withinDeadline(() => Promise.resolve(42), 100)).resolves.toBe(42)

        expect(jest.getTimerCount()).toBe(0)
    })

    it("preserves the operation failure and clears its deadline", async () => {
        const failure = new Error("dependency refused")

        await expect(withinDeadline(() => Promise.reject(failure), 100)).rejects.toBe(failure)

        expect(jest.getTimerCount()).toBe(0)
    })

    it("clears the deadline when the operation throws before returning a promise", async () => {
        const failure = new HttpError({ code: HttpErrorCode.Network })

        await expect(
            withinDeadline(() => {
                throw failure
            }, 100),
        ).rejects.toBe(failure)

        expect(jest.getTimerCount()).toBe(0)
    })

    it("expires a hung operation and still handles a later rejection", async () => {
        let rejectOperation: (error: Error) => void = () => {}
        const operation = new Promise<void>((_resolve, reject) => {
            rejectOperation = reject
        })
        const result = withinDeadline(() => operation, 100)
        const expiration = expect(result).rejects.toMatchObject({ code: HttpErrorCode.Timeout })

        await jest.advanceTimersByTimeAsync(100)
        await expiration
        rejectOperation(new Error("late dependency failure"))
        await Promise.resolve()

        expect(jest.getTimerCount()).toBe(0)
    })
})
