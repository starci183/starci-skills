import { FakeClock, fakeIds, mock } from "@starci/jest-preset"
import { JobClaimService, JobRunnerService, JobsLogEvent } from "@modules/platform/jobs"
import type { Logger } from "@modules/platform/logging"
import type { QueueDelivery, QueueWorkerRegistry } from "@modules/platform/queue"
import { createJobsBuilder } from "../fixtures/builders/jobs.builder"

import type { TestDatabases } from "./use-test-world"
/** Composes the real fenced claim and runner collaborators on the world's current transaction. */
export const createJobsProof = (db: TestDatabases) => {
    const LEASE_MS = 100
    const database = createJobsBuilder(() => db.primary, fakeIds())
    const build = (scenario: string) => {
        const delivery: QueueDelivery = {
            id: database.key(scenario),
            queue: "receipt",
            payload: { id: "order-1" },
            attempt: 1,
        }
        const clock = new FakeClock("2026-10-14T00:00:00.000Z")
        const claims = new JobClaimService([database.manager], clock)
        const successorClaims = new JobClaimService([database.manager], clock)
        const logger = mock<Logger>()
        const runner = new JobRunnerService(
            { connection: "primary", workerId: "worker-1", leaseMs: LEASE_MS },
            claims,
            mock<QueueWorkerRegistry>(),
            logger,
        )
        const claim = (worker: JobClaimService, workerId: string) =>
            worker.claim({
                kind: delivery.queue,
                jobKey: delivery.id,
                payload: delivery.payload,
                workerId,
                leaseMs: LEASE_MS,
            })
        return { clock, claims, successorClaims, logger, runner, claim, delivery }
    }

    return { database, build, events: JobsLogEvent }
}
