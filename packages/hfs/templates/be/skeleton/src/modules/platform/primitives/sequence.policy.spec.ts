import { DomainError } from "@modules/platform/errors"
import { eachInOrder } from "./sequence.policy"

type SequenceErrorCode = "STEP_FAILED"

class SequenceError extends DomainError<SequenceErrorCode> {}

const pause = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

describe("eachInOrder", () => {
    it("starts an item only after the one before it settled, in item order", async () => {
        const events: Array<string> = []

        await eachInOrder(new Set(["a", "b", "c"]), async (item, index) => {
            events.push(`start ${item} ${index}`)
            await pause()
            events.push(`end ${item}`)
        })

        expect(events).toEqual(["start a 0", "end a", "start b 1", "end b", "start c 2", "end c"])
    })

    it("answers nothing for an empty list", async () => {
        await expect(eachInOrder([], () => Promise.resolve())).resolves.toBeUndefined()
    })

    it("rejects with the first failure and never starts the items after it", async () => {
        const started: Array<number> = []

        const run = eachInOrder([1, 2, 3], async (item) => {
            started.push(item)
            await pause()
            if (item === 2) throw new SequenceError({ code: "STEP_FAILED" })
        })

        await expect(run).rejects.toThrow(expect.objectContaining({ code: "STEP_FAILED" }))
        expect(started).toEqual([1, 2])
    })

    it("rejects when a step throws before it returns a promise", async () => {
        const run = eachInOrder([1], (): Promise<void> => {
            throw new SequenceError({ code: "STEP_FAILED" })
        })

        await expect(run).rejects.toThrow(expect.objectContaining({ code: "STEP_FAILED" }))
    })
})
