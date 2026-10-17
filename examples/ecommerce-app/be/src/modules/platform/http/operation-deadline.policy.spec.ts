import { Test } from "@nestjs/testing"
import { HttpError, HttpErrorCode } from "./errors/http.error"
import { withinDeadline } from "./operation-deadline.policy"

const SUBJECT: unique symbol = Symbol("http/operation-deadline.policy")
const subjectFunctions = () => ({ withinDeadline })

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: subjectFunctions }],
    }).compile()
    return moduleRef.get<ReturnType<typeof subjectFunctions>>(SUBJECT)
}

describe("withinDeadline", () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it("returns a completed answer and clears its deadline", async () => {
        const subject = await build()

        await expect(subject.withinDeadline(() => Promise.resolve(42), 100)).resolves.toBe(42)

        expect(jest.getTimerCount()).toBe(0)
    })

    it("preserves the operation failure and clears its deadline", async () => {
        const subject = await build()

        const failure = new Error("dependency refused")

        await expect(subject.withinDeadline(() => Promise.reject(failure), 100)).rejects.toBe(failure)

        expect(jest.getTimerCount()).toBe(0)
    })

    it("clears the deadline when the operation throws before returning a promise", async () => {
        const subject = await build()

        const failure = new HttpError({ code: HttpErrorCode.Network })

        await expect(
            subject.withinDeadline(() => {
                throw failure
            }, 100),
        ).rejects.toBe(failure)

        expect(jest.getTimerCount()).toBe(0)
    })

    it("expires a hung operation and still handles a later rejection", async () => {
        const subject = await build()

        let rejectOperation: (error: Error) => void = () => {}
        const operation = new Promise<void>((_resolve, reject) => {
            rejectOperation = reject
        })
        const result = subject.withinDeadline(() => operation, 100)
        const expiration = expect(result).rejects.toMatchObject({ code: HttpErrorCode.Timeout })

        await jest.advanceTimersByTimeAsync(100)
        await expiration
        rejectOperation(new Error("late dependency failure"))
        await Promise.resolve()

        expect(jest.getTimerCount()).toBe(0)
    })
})
