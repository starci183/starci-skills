import { ATTEMPTS, BACKOFF_MS, KEEP_COMPLETED_SECONDS, jobNameOf } from "./queue.policy"

describe("queue policy", () => {
    it("declares the retry and retention budget of every job", () => {
        expect({
            attempts: ATTEMPTS,
            backoffMs: BACKOFF_MS,
            keepCompletedSeconds: KEEP_COMPLETED_SECONDS,
        }).toEqual({
            attempts: 5,
            backoffMs: 1000,
            keepCompletedSeconds: 3600,
        })
    })

    it("uses the queue name as the BullMQ job name", () => {
        expect(jobNameOf("orders")).toBe("orders")
    })
})
