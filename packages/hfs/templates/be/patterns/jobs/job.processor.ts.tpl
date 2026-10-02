import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { @@jobUpper@@_QUEUE } from "@modules/queues/@@job@@"
import { @@Step@@Step } from "./steps/@@step@@.step"

@Injectable()
/** The processor of the @@job@@ job: the runner claims and settles, `process` runs the steps in order. */
export class @@Job@@Processor extends FencedProcessor {
    readonly queue = @@jobUpper@@_QUEUE

    constructor(private readonly @@stepCamel@@Step: @@Step@@Step) {
        super()
    }

    /** Runs the steps of the job; a stale token makes a guarded write throw `JobFencedOut` and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.@@stepCamel@@Step.run(job)
    }
}
