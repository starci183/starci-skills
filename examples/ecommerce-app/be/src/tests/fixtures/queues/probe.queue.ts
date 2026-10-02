import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The queue of the probe job the queue and job specs run. */
export const PROBE_QUEUE = "probe"

/** The payload of one probe job. */
export interface ProbePayload {
    /** A text the worker sees back. */
    readonly note: string
}

@Injectable()
/** The typed producer of the probe queue: it enqueues in the transaction of the caller, as a `<queue>.queue.ts` does. */
export class ProbeQueue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues one probe job in the transaction `tx`. */
    enqueueProbe(payload: ProbePayload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, PROBE_QUEUE, payload)
    }
}
