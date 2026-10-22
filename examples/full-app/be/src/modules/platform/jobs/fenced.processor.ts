import type { ClaimedJob } from "./jobs.contracts"

/**
 * The base of every job processor. The runner claims the delivery with a bumped fencing token, calls `process`, and settles the job
 * through the guarded writes, so a processor holds only what its job does and never touches the job row.
 */
export abstract class FencedProcessor {
    /** The queue this processor consumes: the `<QUEUE>_QUEUE` constant of its `modules/queues/<queue>`. */
    abstract readonly queue: string

    /** Runs the job; a throw fails this delivery and BullMQ retries it. */
    abstract process(job: ClaimedJob): Promise<void>
}
