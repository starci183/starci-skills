import type { EntityManager } from "typeorm"
import type {
    BuryMessageParams,
    ClaimDueParams,
    OutboxMessage,
    OutboxRecord,
    RetryMessageParams,
} from "./outbox.contracts"

/** The durable message store: producers write into it, the messaging capability delivers from it. */
export interface Outbox {
    /** Writes the message in the transaction of `manager`, so it exists exactly when the change that caused it commits. */
    enqueue(manager: EntityManager, message: OutboxMessage): Promise<void>
    /** Claims the due messages of the given queues for one delivery attempt each. */
    claimDue(params: ClaimDueParams): Promise<Array<OutboxRecord>>
    /** Marks a delivered message as done. */
    complete(id: string): Promise<void>
    /** Schedules the next delivery of a failed message. */
    retry(params: RetryMessageParams): Promise<void>
    /** Marks a message that ran out of attempts as dead. */
    bury(params: BuryMessageParams): Promise<void>
}
