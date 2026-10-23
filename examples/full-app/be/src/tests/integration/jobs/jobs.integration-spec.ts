import { fakeIds, mock } from "@starci/jest-preset"
import assert from "node:assert"
import type { ReceiptService } from "@modules/domain/order"
import type { ClaimedJob } from "@modules/platform/jobs"
import { StoreReceiptStep } from "../../../features/jobs/send-receipt/steps/store-receipt.step"
import { SendReceiptProcessor } from "../../../features/jobs/send-receipt/transport/queue/send-receipt.processor"
import { readRows } from "../../fixtures/persistence/e2e-verification.rows"
import { JOB_OF_KEY } from "../../fixtures/queues/probe.sql"
import { ProbeJobBehavior } from "../../world/probe-job.module"
import { JOBS_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

/** Asymmetric matchers read as `unknown`: jest types them `any`, which may not flow into a property or a typed argument. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** The ids of the rows and keys this spec arranges: deterministic, so a failing run reproduces. */
const ids = fakeIds()

const expectFencedOut = (write: () => Promise<void>): Promise<void> =>
    expect(write()).rejects.toMatchObject({ code: FENCED_OUT })

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
            () => {
                seen += 1
                return Promise.resolve(seen)
            },
            (observed) => observed >= 2,
        )
    }

    it("fenced-job/claim-bumps-token: a first claim holds token 1, a live claim blocks a second worker, an expired one is taken with a bigger token", () =>
        bumpsClaimToken(world, claim, leaseExpires))

    it("fenced-job/zombie-fenced-out: a worker whose claim was taken over changes nothing and learns it from JobFencedOut", () =>
        fencesZombie(world, claims, claim, leaseExpires, expectFencedOut))

    it("fenced-job/redispatch-isolated: a redelivery after a failure runs under a new token and run key, and the first attempt cannot write", () =>
        isolatesRedispatch(claims, claim, expectFencedOut))
})

async function bumpsClaimToken(
    world: ReturnType<typeof useTestWorld>,
    claim: (jobKey: string, leaseMs?: number) => Promise<ClaimedJob | null>,
    leaseExpires: () => Promise<number>,
): Promise<void> {
    const key = `claim-${ids.next()}`

    const first = await claim(key)
    const blocked = await claim(key)
    await leaseExpires()
    const second = await claim(key)

    expect(first?.fencingToken).toBe(1)
    expect(blocked).toBeNull()
    expect(second?.fencingToken).toBe(2)
    expect(second?.jobId).toBe(first?.jobId)
    expect(await readRows(world.db.order, JOB_OF_KEY, [key])).toEqual([
        objectLike({ status: "running", fencing_token: "2" }),
    ])
}

async function fencesZombie(
    world: ReturnType<typeof useTestWorld>,
    claims: () => ProbeJobBehavior["claims"],
    claim: (jobKey: string, leaseMs?: number) => Promise<ClaimedJob | null>,
    leaseExpires: () => Promise<number>,
    expectFencedOut: (write: () => Promise<void>) => Promise<void>,
): Promise<void> {
    const key = `zombie-${ids.next()}`
    const zombie = await claim(key)
    await leaseExpires()
    const owner = await claim(key)
    assert(zombie !== null && owner !== null)

    const receipts = mock<ReceiptService>()
    const processor = new SendReceiptProcessor(new StoreReceiptStep(receipts, claims()))
    await expectFencedOut(() => processor.process(zombie))
    expect(receipts.archiveReceipt).not.toHaveBeenCalled()

    await expectFencedOut(() =>
        claims().advance({ jobId: zombie.jobId, expectedFencingToken: zombie.fencingToken, step: "charge" }),
    )
    await expectFencedOut(() => claims().complete({ jobId: zombie.jobId, expectedFencingToken: zombie.fencingToken }))
    expect(await readRows(world.db.order, JOB_OF_KEY, [key])).toEqual([
        objectLike({ status: "running", current_step: null }),
    ])

    await claims().advance({ jobId: owner.jobId, expectedFencingToken: owner.fencingToken, step: "charge" })
    await claims().complete({ jobId: owner.jobId, expectedFencingToken: owner.fencingToken })
    expect(await readRows(world.db.order, JOB_OF_KEY, [key])).toEqual([
        objectLike({ status: "done", current_step: "charge" }),
    ])
    expect(await claim(key)).toBeNull()
}

async function isolatesRedispatch(
    claims: () => ProbeJobBehavior["claims"],
    claim: (jobKey: string, leaseMs?: number) => Promise<ClaimedJob | null>,
    expectFencedOut: (write: () => Promise<void>) => Promise<void>,
): Promise<void> {
    const key = `redispatch-${ids.next()}`
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
}
