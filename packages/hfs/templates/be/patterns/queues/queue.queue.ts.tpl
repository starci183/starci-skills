import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"

/** The queue name: the contract between this producer and the processor of the job. */
export const {{queueUpper}}_QUEUE = "{{queue}}"

/** The payload of one {{queue}} job: ids only. */
export interface {{Queue}}Payload {
    readonly id: string
}

@Injectable()
/** The typed producer of the {{queue}} queue. */
export class {{Queue}}Queue {
    constructor(@InjectQueueOutbox() private readonly outbox: QueueOutbox) {}

    /** Enqueues one {{queue}} job in the transaction of the caller: the job exists exactly when the change that needs it commits. */
    enqueue{{Queue}}(payload: {{Queue}}Payload, tx: EntityManager): Promise<void> {
        return this.outbox.write(tx, {{queueUpper}}_QUEUE, payload)
    }
}
