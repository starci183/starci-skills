import type { EntityManager } from "typeorm"
import { PGMQ_READ, PGMQ_DELETE } from "./persistence/queue.sql"
import { eachInOrder } from "@modules/platform/primitives"
import type { InspectedQueueRow, QueueMessageMatch } from "./types/queue-inspection.contracts"

/** Reads visible queue deliveries with zero visibility timeout for local stack diagnostics. */
export class QueueInspectionClient {
    /** Reads on the caller's connection, preserving transaction visibility; pgmq increments read counts. */
    messages(manager: EntityManager, queue: string): Promise<Array<InspectedQueueRow>> {
        return manager.query<Array<InspectedQueueRow>>(PGMQ_READ, [queue, 0, 2147483647])
    }
    /** Deletes only matching deliveries through the queue transport's database door. */
    async cleanup(manager: EntityManager, queue: string, matches: QueueMessageMatch): Promise<void> {
        const messages = (await this.messages(manager, queue)).filter(matches)
        await eachInOrder(messages, (message) => manager.query(PGMQ_DELETE, [queue, message.msg_id]))
    }
}
