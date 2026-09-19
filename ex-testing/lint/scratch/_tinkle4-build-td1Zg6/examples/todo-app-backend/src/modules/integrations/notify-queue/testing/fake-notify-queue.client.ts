import {
    NotifyQueuePort 
} from "../notify-queue.contracts"

/** An in-process fake for `NotifyQueuePort` - a sorted array standing in for the Redis sorted set, with
 * exactly the same "enqueue replaces, dequeueDue removes atomically" semantics the real client gives. */
export class FakeNotifyQueueClient extends NotifyQueuePort {
    private readonly jobs = new Map<string, number>()

    async enqueue(jobId: string, dueAtMs: number): Promise<void> {
        this.jobs.set(jobId,
            dueAtMs)
    }

    async dequeueDue(nowMs: number): Promise<Array<string>> {
        const due: Array<string> = []
        for (const [jobId,
            dueAtMs] of this.jobs) {
            if (dueAtMs <= nowMs) due.push(jobId)
        }
        for (const jobId of due) this.jobs.delete(jobId)
        return due
    }

    /** Test-only inspection: whether a job is still sitting in the queue, unresolved. */
    has(jobId: string): boolean {
        return this.jobs.has(jobId)
    }
}
