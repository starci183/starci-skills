import { eachInOrder, mapInOrder, repeatInOrder } from "./sequence.policy"

const pause = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

describe("sequence policy", () => {
    describe("mapInOrder", () => {
        it("answers the results in item order and starts an item only after the one before it settled", async () => {
            const events: Array<string> = []

            const results = await mapInOrder([3, 1, 2], async (item, index) => {
                events.push(`start ${item}`)
                await pause()
                events.push(`end ${item}`)
                return index * 10 + item
            })

            expect(results).toEqual([3, 11, 22])
            expect(events).toEqual(["start 3", "end 3", "start 1", "end 1", "start 2", "end 2"])
        })

        it("rejects with the first failure and never starts the items after it", async () => {
            const started: Array<number> = []

            const run = mapInOrder([1, 2, 3], async (item) => {
                started.push(item)
                if (item === 2) throw new Error("second failed")
                await pause()
                return item
            })

            await expect(run).rejects.toThrow("second failed")
            expect(started).toEqual([1, 2])
        })

        it("rejects when a step throws before it returns a promise", async () => {
            const run = mapInOrder([1], (): Promise<number> => {
                throw new Error("sync throw")
            })

            await expect(run).rejects.toThrow("sync throw")
        })

        it("answers an empty list at once", async () => {
            await expect(mapInOrder([], () => Promise.resolve(1))).resolves.toEqual([])
        })
    })

    describe("eachInOrder", () => {
        it("runs every step in order and answers nothing", async () => {
            const seen: Array<string> = []

            const answer = await eachInOrder(new Set(["a", "b"]), async (item) => {
                await pause()
                seen.push(item)
            })

            expect(answer).toBeUndefined()
            expect(seen).toEqual(["a", "b"])
        })
    })

    describe("repeatInOrder", () => {
        it("repeats until an attempt answers something other than undefined, and answers it", async () => {
            const attempts: Array<number> = []

            const result = await repeatInOrder(async (attempt) => {
                attempts.push(attempt)
                await pause()
                return attempt === 2 ? "done" : undefined
            })

            expect(result).toBe("done")
            expect(attempts).toEqual([0, 1, 2])
        })

        it("stops on a falsy answer that is not undefined", async () => {
            await expect(repeatInOrder(() => Promise.resolve(false))).resolves.toBe(false)
        })

        it("rejects when an attempt rejects or throws", async () => {
            await expect(repeatInOrder(() => Promise.reject(new Error("attempt failed")))).rejects.toThrow(
                "attempt failed",
            )
            await expect(
                repeatInOrder((): Promise<number> => {
                    throw new Error("attempt threw")
                }),
            ).rejects.toThrow("attempt threw")
        })
    })
})
