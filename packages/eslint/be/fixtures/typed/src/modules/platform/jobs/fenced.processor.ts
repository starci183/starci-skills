import type { ClaimedJob } from "./jobs.contracts"

/** The base of every job processor: it claims, calls `process`, and settles through the guarded writes. */
export abstract class FencedProcessor {
    abstract process(job: ClaimedJob): Promise<void>
}
