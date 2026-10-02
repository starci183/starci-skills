import assert from "node:assert"
import { randomUUID } from "node:crypto"
import type { ClaimedJob } from "@modules/platform/jobs"
import { readRows } from "../../fixtures/persistence/e2e-verification.rows"
import { JOB_OF_KEY } from "../../fixtures/queues/probe.sql"
import { ProbeJobBehavior } from "../../world/probe-job.module"
import { JOBS_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

/** A claim lease short enough that a spec waits it out: one 250 ms poll is enough. */
const LEASE_MS = 150

/** The code of a write by a worker that lost its claim. */
const FENCED_OUT = "JOBS_FENCED_OUT"

/**
 * fenced-job: the real job row of the order database. A claim bumps the fencing token in one statement, every later write is
 * guarded by the token it holds, and a zombie that lost its claim is fenced out; a redelivery runs under a new token and a new
 * run key. The three scenarios are the proof of the declared `fenced-job` pattern.
 */
describe("fenced jobs (integration)", () => {
    const world = useTestWorld({ modules: JOBS_CAPABILITY_MODULES })

    const claims = () => world.resolve(ProbeJobBehavior).claims
    const claim = (jobKey: string, leaseMs: number = LEASE_MS): Promise<ClaimedJob | null> =>
        claims().claim({ kind: "manual", jobKey, payload: { id: jobKey }, workerId: "spec", leaseMs })
    const leaseExpires = (): Promise<number> => {
        let seen = 0
        return world.waitUntil(
            "the lease expired",
            () => Promise.resolve((seen += 1)),
            (observed) => observed >= 2,
        )
    }
    const expectFencedOut = (write: () => Promise<void>): Promise<void> =>
        expect(write()).rejects.toMatchObject({ code: FENCED_OUT })

    it("fenced-job/claim-bumps-token: a first claim holds token 1, a live claim blocks a second worker, an expired one is taken with a bigger token", async () => {
        const key = `claim-${randomUUID()}`

        const first = await claim(key)
        const blocked = await claim(key)
        await leaseExpires()
        const second = await claim(key)

        expect(first?.fencingToken).toBe(1)
        expect(blocked).toBeNull()
        expect(second?.fencingToken).toBe(2)
        expect(second?.jobId).toBe(first?.jobId)
        expect(await readRows(world.db.order, JOB_OF_KEY, [key])).toEqual([
            expect.objectContaining({ status: "running", fencing_token: "2" }),
        ])
    })

    it("fenced-job/zombie-fenced-out: a worker whose claim was taken over changes nothing and learns it from JobFencedOut", async () => {
        const key = `zombie-${randomUUID()}`
        const zombie = await claim(key)
        await leaseExpires()
        const owner = await claim(key)
        assert(zombie !== null && owner !== null)

        await expectFencedOut(() =>
            claims().advance({ jobId: zombie.jobId, expectedFencingToken: zombie.fencingToken, step: "charge" }),
        )
        await expectFencedOut(() =>
            claims().complete({ jobId: zombie.jobId, expectedFencingToken: zombie.fencingToken }),
        )
        expect(await readRows(world.db.order, JOB_OF_KEY, [key])).toEqual([
            expect.objectContaining({ status: "running", current_step: null }),
        ])

        await claims().advance({ jobId: owner.jobId, expectedFencingToken: owner.fencingToken, step: "charge" })
        await claims().complete({ jobId: owner.jobId, expectedFencingToken: owner.fencingToken })
        expect(await readRows(world.db.order, JOB_OF_KEY, [key])).toEqual([
            expect.objectContaining({ status: "done", current_step: "charge" }),
        ])
        expect(await claim(key)).toBeNull()
    })

    it("fenced-job/redispatch-isolated: a redelivery after a failure runs under a new token and run key, and the first attempt cannot write", async () => {
        const key = `redispatch-${randomUUID()}`
        const first = await claim(key, 60_000)
        assert(first !== null)
        await claims().fail({ jobId: first.jobId, expectedFencingToken: first.fencingToken, reason: "provider down" })

        const second = await claim(key, 60_000)
        assert(second !== null)

        expect(second.fencingToken).toBe(first.fencingToken + 1)
        expect(claims().runKey(second, "charge")).not.toBe(claims().runKey(first, "charge"))
        expect(claims().runKey(second, "charge")).toBe(`${second.jobId}:charge:${second.fencingToken}`)
        await expectFencedOut(() =>
            claims().fail({ jobId: first.jobId, expectedFencingToken: first.fencingToken, reason: "late" }),
        )
        await claims().complete({ jobId: second.jobId, expectedFencingToken: second.fencingToken })
    })
})
