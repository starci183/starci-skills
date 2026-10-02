import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectQueueWorkerRegistry } from "@modules/platform/queue"
import type { QueueDelivery, QueueWorkerRegistry } from "@modules/platform/queue"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { ClaimedJob } from "./jobs.contracts"
import { InjectJobClaims, InjectJobsOptions } from "./jobs.decorators"
import { JobsLogEvent } from "./jobs.log-events"
import type { JobsOptions } from "./jobs.options"
import type { JobClaims, JobProcessorRegistry } from "./jobs.port"
import type { FencedProcessor } from "./fenced.processor"

const isFencedOut = (cause: unknown): boolean => cause instanceof JobsError && cause.code === JobsErrorCode.FencedOut

@Injectable()
/**
 * The runner of fenced jobs: it subscribes each registered processor to its queue and, for every delivery, claims the job (bumping the
 * fencing token), calls the processor and settles the job through the guarded writes. A `JobFencedOut` means a newer worker owns the
 * job: this worker stops with no further effect and the delivery is acknowledged. Any other failure marks the job failed and is
 * rethrown, so BullMQ retries the delivery and the next claim bumps the token again.
 */
export class JobRunnerService implements JobProcessorRegistry {
    constructor(
        @InjectJobsOptions() private readonly options: JobsOptions,
        @InjectJobClaims() private readonly claims: JobClaims,
        @InjectQueueWorkerRegistry() private readonly queues: QueueWorkerRegistry,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Subscribes the processor to its queue. */
    add(processor: FencedProcessor): void {
        this.queues.add(processor.queue, (delivery) => this.run(processor, delivery))
    }

    /** Runs one delivery of the processor's queue. */
    async run(processor: FencedProcessor, delivery: QueueDelivery): Promise<void> {
        const job = await this.claims.claim({
            kind: processor.queue,
            jobKey: delivery.id,
            payload: delivery.payload,
            workerId: this.options.workerId,
            leaseMs: this.options.leaseMs,
        })
        if (job === null) return
        try {
            await processor.process(job)
            await this.claims.complete({ jobId: job.jobId, expectedFencingToken: job.fencingToken })
        } catch (cause) {
            if (isFencedOut(cause)) {
                this.logger.warn(JobsLogEvent.FencedOut, { jobId: job.jobId, token: job.fencingToken })
                return
            }
            await this.recordFailure(job, cause)
            throw cause
        }
    }

    private async recordFailure(job: ClaimedJob, cause: unknown): Promise<void> {
        const reason = cause instanceof Error ? cause.message : String(cause)
        this.logger.error(JobsLogEvent.DeliveryFailed, cause, { jobId: job.jobId, token: job.fencingToken })
        await this.claims.fail({ jobId: job.jobId, expectedFencingToken: job.fencingToken, reason }).catch((failure: unknown) => {
            if (isFencedOut(failure)) this.logger.warn(JobsLogEvent.FencedOut, { jobId: job.jobId, token: job.fencingToken })
            else this.logger.error(JobsLogEvent.FailureNotRecorded, failure, { jobId: job.jobId })
        })
    }
}
