import { Injectable, Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { FencedProcessor, InjectJobClaims, InjectJobProcessorRegistry } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobProcessorRegistry } from "@modules/platform/jobs"
import { PROBE_QUEUE } from "../fixtures/queues/probe.queue"

@Injectable()
/** What the probe processor does with a job, set by the spec that drives it, and the claims port the specs drive directly. */
export class ProbeJobBehavior {
    /** True while the processor throws. */
    failing = false
    /** The jobs the processor saw, with the token and the run key of their claim, in arrival order. */
    readonly seen: Array<{ readonly jobId: string; readonly token: number; readonly runKey: string }> = []

    constructor(@InjectJobClaims() readonly claims: JobClaims) {}
}

@Injectable()
/** The fenced processor of the probe queue: it records the claim it runs under, or rejects while the spec says so. */
export class ProbeProcessor extends FencedProcessor {
    readonly queue = PROBE_QUEUE

    constructor(private readonly behavior: ProbeJobBehavior) {
        super()
    }

    /** Records the claim; a failing probe rejects. */
    process(job: ClaimedJob): Promise<void> {
        this.behavior.seen.push({
            jobId: job.jobId,
            token: job.fencingToken,
            runKey: this.behavior.claims.runKey(job, "probe"),
        })
        return this.behavior.failing ? Promise.reject(new Error("probe job failed")) : Promise.resolve()
    }
}

@Module({ providers: [ProbeJobBehavior, ProbeProcessor], exports: [ProbeJobBehavior] })
/** Registers the probe processor with the jobs runner, the way a job module does. */
export class ProbeJobModule implements OnModuleInit {
    constructor(
        @InjectJobProcessorRegistry() private readonly registry: JobProcessorRegistry,
        private readonly processor: ProbeProcessor,
    ) {}

    /** Hands the processor to the registry. */
    onModuleInit(): void {
        this.registry.add(this.processor)
    }
}
