import assert from "node:assert/strict"
import type { ClaimedJob, FencedProcessor } from "@modules/platform/jobs"
import { useTestWorld, TestWorldError, TestWorldErrorCode, createJobsProof } from "../../world/kit"

const LEASE_MS = 100
const world = useTestWorld({ modules: createJobsProof, rollback: true })

/** Collaboration proofs use the real claim and runner services and the migrated local Supabase job table. */
const registerClaimProof = () => {
    it("fenced-job/claim-bumps-token: a live lease blocks a second worker and expiration advances the same row's token", async () => {
        const { clock, claims, successorClaims, claim, delivery } = world.modules.build("claim")
        const results = await Promise.all([claim(claims, "worker-1"), claim(successorClaims, "worker-2")])
        const first = results.find((job) => job !== null)
        assert(first !== undefined && first !== null)
        expect(first.fencingToken).toBe(1)
        expect(results.filter((job) => job === null)).toHaveLength(1)

        clock.advance(LEASE_MS)
        expect(await claim(successorClaims, "worker-2")).toBeNull()
        clock.advance(1)
        const successor = await claim(successorClaims, "worker-2")
        assert(successor !== null)

        expect(successor.jobId).toBe(first.jobId)
        expect(successor.fencingToken).toBe(first.fencingToken + 1)
        expect(await world.modules.database.snapshot(delivery.id)).toMatchObject({
            status: "running",
            fencing_token: "2",
        })
        await successorClaims.complete({ jobId: successor.jobId, expectedFencingToken: successor.fencingToken })
        clock.advance(LEASE_MS + 1)
        expect(await claim(claims, "worker-1")).toBeNull()
    })
}

const registerZombieProof = () => {
    it("fenced-job/zombie-fenced-out: stale writes and runner settlement cannot overwrite the successor's progress", async () => {
        const { clock, claims, successorClaims, claim, runner, logger, delivery } = world.modules.build("zombie")
        const attempts: Array<ClaimedJob> = []
        let release = () => {}
        const gate = new Promise<void>((resolve) => {
            release = resolve
        })
        let started = () => {}
        const processing = new Promise<void>((resolve) => {
            started = resolve
        })
        const processor: FencedProcessor = {
            queue: delivery.queue,
            process: async (job) => {
                attempts.push(job)
                started()
                await gate
            },
        }
        const pending = runner.run(processor, delivery)
        await processing
        clock.advance(LEASE_MS + 1)
        const owner = await claim(successorClaims, "worker-2")
        const [zombie] = attempts
        assert(owner !== null && zombie !== undefined)
        const stale = { jobId: zombie.jobId, expectedFencingToken: zombie.fencingToken }
        await successorClaims.advance({
            jobId: owner.jobId,
            expectedFencingToken: owner.fencingToken,
            step: "archived",
        })
        const before = await world.modules.database.snapshot(delivery.id)

        await expect(claims.advance({ ...stale, step: "late" })).rejects.toMatchObject({ code: "JOBS_FENCED_OUT" })
        await expect(claims.complete(stale)).rejects.toMatchObject({ code: "JOBS_FENCED_OUT" })
        await expect(claims.fail({ ...stale, reason: "late failure" })).rejects.toMatchObject({
            code: "JOBS_FENCED_OUT",
        })
        release()
        await expect(pending).resolves.toBeUndefined()

        expect(await world.modules.database.snapshot(delivery.id)).toEqual(before)
        expect(logger.warn).toHaveBeenCalledWith(world.modules.events.FencedOut, { jobId: zombie.jobId })
        expect(logger.error).not.toHaveBeenCalled()
        await successorClaims.complete({ jobId: owner.jobId, expectedFencingToken: owner.fencingToken })
        expect(await world.modules.database.snapshot(delivery.id)).toMatchObject({
            status: "done",
            current_step: "archived",
            fencing_token: "2",
        })
    })
}

const registerRedispatchProof = () => {
    it("fenced-job/redispatch-isolated: runner retries preserve progress while replacing the token and external run key", async () => {
        const { claims, runner, delivery } = world.modules.build("redispatch")
        const attempts: Array<ClaimedJob> = []
        const keys: Array<string> = []
        const providerDown = new TestWorldError({ code: TestWorldErrorCode.ProviderDown })
        const processor: FencedProcessor = {
            queue: delivery.queue,
            process: async (job) => {
                attempts.push(job)
                keys.push(claims.runKey(job, "archive"))
                await claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "prepared" })
                if (attempts.length === 1) throw providerDown
                await claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "archived" })
            },
        }
        await expect(runner.run(processor, delivery)).rejects.toBe(providerDown)
        expect(await world.modules.database.snapshot(delivery.id)).toMatchObject({
            status: "failed",
            error: TestWorldErrorCode.ProviderDown,
            fencing_token: "1",
        })
        await runner.run(processor, { ...delivery, attempt: 2 })
        const [first, second] = attempts
        assert(first !== undefined && second !== undefined)

        expect(second).toMatchObject({
            jobId: first.jobId,
            fencingToken: first.fencingToken + 1,
            currentStep: "prepared",
        })
        expect(keys).toEqual([`${first.jobId}:archive:1`, `${second.jobId}:archive:2`])
        await expect(
            claims.fail({ jobId: first.jobId, expectedFencingToken: first.fencingToken, reason: "late" }),
        ).rejects.toMatchObject({ code: "JOBS_FENCED_OUT" })
        expect(await world.modules.database.snapshot(delivery.id)).toMatchObject({
            status: "done",
            current_step: "archived",
            fencing_token: "2",
            error: null,
        })
        await runner.run(processor, { ...delivery, attempt: 3 })
        expect(attempts).toHaveLength(2)
    })
}

describe("fenced jobs (lite integration)", () => {
    registerClaimProof()
    registerZombieProof()
    registerRedispatchProof()
})
