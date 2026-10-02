import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_WORKER_REGISTRY } from "@modules/platform/queue"
import type { QueueDelivery, QueueHandler, QueueWorkerRegistry } from "@modules/platform/queue"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { FencedProcessor } from "./fenced.processor"
import type { ClaimedJob } from "./jobs.contracts"
import { JOB_CLAIMS, JOBS_OPTIONS } from "./jobs.decorators"
import { JobsLogEvent } from "./jobs.log-events"
import type { JobsOptions } from "./jobs.options"
import type { JobClaims } from "./jobs.port"
import { JobRunnerService } from "./job-runner.service"

const options: JobsOptions = { connection: "primary", workerId: "w-1", leaseMs: 60000 }
const delivery: QueueDelivery = { id: "k-1", queue: "mail", payload: { id: "m-1" }, attempt: 1 }
const job: ClaimedJob = { jobId: "j-1", kind: "mail", fencingToken: 2, currentStep: null, payload: { id: "m-1" } }
const fenced = (): JobsError => new JobsError({ code: JobsErrorCode.FencedOut, params: { jobId: "j-1", token: 2 } })

const build = async () => {
    const claims = mock<JobClaims>()
    claims.fail.mockResolvedValue(undefined)
    const queues = mock<QueueWorkerRegistry>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            JobRunnerService,
            { provide: JOBS_OPTIONS, useValue: options },
            { provide: JOB_CLAIMS, useValue: claims },
            { provide: QUEUE_WORKER_REGISTRY, useValue: queues },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return {
        runner: moduleRef.get(JobRunnerService),
        claims,
        queues,
        logger,
        processor: mock<FencedProcessor>({ queue: "mail" }),
    }
}

describe("JobRunnerService", () => {
    describe("add", () => {
        it("subscribes the processor to its queue, and the handler runs a delivery through the fence", async () => {
            const { runner, claims, queues, processor } = await build()
            claims.claim.mockResolvedValue(job)
            runner.add(processor)
            const [queue, handler] = queues.add.mock.calls[0] as [string, QueueHandler]

            await handler(delivery)

            expect(queue).toBe("mail")
            expect(processor.process).toHaveBeenCalledWith(job)
        })
    })

    describe("run", () => {
        it("claims the delivery with the job key and the lease, processes it and completes it under the claimed token", async () => {
            const { runner, claims, processor } = await build()
            claims.claim.mockResolvedValue(job)

            await runner.run(processor, delivery)

            expect(claims.claim).toHaveBeenCalledWith({
                kind: "mail",
                jobKey: "k-1",
                payload: { id: "m-1" },
                workerId: "w-1",
                leaseMs: 60000,
            })
            expect(processor.process).toHaveBeenCalledWith(job)
            expect(claims.complete).toHaveBeenCalledWith({ jobId: "j-1", expectedFencingToken: 2 })
            expect(claims.fail).not.toHaveBeenCalled()
        })

        it("does nothing when the job is done or another worker holds a live claim", async () => {
            const { runner, claims, processor } = await build()
            claims.claim.mockResolvedValue(null)

            await runner.run(processor, delivery)

            expect(processor.process).not.toHaveBeenCalled()
            expect(claims.complete).not.toHaveBeenCalled()
        })

        it("stops quietly when a write is fenced out: a newer worker owns the job and this one causes no further effect", async () => {
            const { runner, claims, logger, processor } = await build()
            claims.claim.mockResolvedValue(job)
            claims.complete.mockRejectedValue(fenced())

            await expect(runner.run(processor, delivery)).resolves.toBeUndefined()

            expect(logger.warn).toHaveBeenCalledWith(JobsLogEvent.FencedOut, { jobId: "j-1", token: 2 })
            expect(claims.fail).not.toHaveBeenCalled()
        })

        it("marks the job failed under its token and rethrows when the processor throws, so BullMQ retries", async () => {
            const { runner, claims, logger, processor } = await build()
            claims.claim.mockResolvedValue(job)
            const failure = new Error("provider down")
            processor.process.mockRejectedValue(failure)

            await expect(runner.run(processor, delivery)).rejects.toBe(failure)

            expect(claims.fail).toHaveBeenCalledWith({ jobId: "j-1", expectedFencingToken: 2, reason: "provider down" })
            expect(logger.error).toHaveBeenCalledWith(JobsLogEvent.DeliveryFailed, failure, { jobId: "j-1", token: 2 })
        })

        it("records a thrown value that is not an Error by its text", async () => {
            const { runner, claims, processor } = await build()
            claims.claim.mockResolvedValue(job)
            processor.process.mockRejectedValue("plain text")

            await expect(runner.run(processor, delivery)).rejects.toBe("plain text")

            expect(claims.fail).toHaveBeenCalledWith({ jobId: "j-1", expectedFencingToken: 2, reason: "plain text" })
        })

        it("still rethrows the original failure when recording it is fenced out, and logs when recording it fails otherwise", async () => {
            const { runner, claims, logger, processor } = await build()
            claims.claim.mockResolvedValue(job)
            const failure = new Error("provider down")
            processor.process.mockRejectedValue(failure)
            claims.fail.mockRejectedValueOnce(fenced())

            await expect(runner.run(processor, delivery)).rejects.toBe(failure)
            expect(logger.warn).toHaveBeenCalledWith(JobsLogEvent.FencedOut, { jobId: "j-1", token: 2 })

            const storeDown = new Error("store down")
            claims.fail.mockRejectedValueOnce(storeDown)

            await expect(runner.run(processor, delivery)).rejects.toBe(failure)
            expect(logger.error).toHaveBeenCalledWith(JobsLogEvent.FailureNotRecorded, storeDown, { jobId: "j-1" })
        })
    })
})
