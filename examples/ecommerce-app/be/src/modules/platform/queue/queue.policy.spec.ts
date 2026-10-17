import { Test } from "@nestjs/testing"
import { ATTEMPTS, BACKOFF_MS, KEEP_COMPLETED_SECONDS, jobNameOf } from "./queue.policy"

const POLICY = Symbol("policy")
const policyFunctions = { jobNameOf }
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useFactory: () => policyFunctions }],
    }).compile()
    return moduleRef.get<typeof policyFunctions>(POLICY)
}

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

    it("uses the queue name as the BullMQ job name", async () => {
        const policy = await build()

        expect(policy.jobNameOf("orders")).toBe("orders")
    })
})
