import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { EntityManager } from "typeorm"
import type {
    BuryMessageParams,
    ClaimDueParams,
    OutboxMessage,
    OutboxRecord,
    RetryMessageParams,
} from "./outbox.contracts"
import type { Outbox } from "./outbox.port"
import { toOutboxRecord } from "./persistence/outbox.rows"
import type { ClaimedMessageRow } from "./persistence/outbox.rows"
import { BURY_MESSAGE, CLAIM_DUE_MESSAGES, COMPLETE_MESSAGE, INSERT_MESSAGE, RETRY_MESSAGE } from "./persistence/outbox.sql"

@Injectable()
/** The Outbox adapter over the outbox table: a plain insert in the caller transaction, a SKIP LOCKED claim for workers. */
export class PostgresOutbox implements Outbox {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Inserts the message through the manager of the caller transaction. */
    async enqueue(manager: EntityManager, message: OutboxMessage): Promise<void> {
        await manager.query(INSERT_MESSAGE, [
            randomUUID(),
            message.queue,
            message.eventId,
            message.payload,
            message.availableAt,
            this.clock.now(),
        ])
    }

    /** Inserts the message on its own connection. */
    async publish(message: OutboxMessage): Promise<void> {
        await this.enqueue(this.entityManager, message)
    }

    /** Claims due messages, counting one attempt and hiding them for the visibility window. */
    async claimDue(params: ClaimDueParams): Promise<Array<OutboxRecord>> {
        const rows: Array<ClaimedMessageRow> = await this.entityManager.query(CLAIM_DUE_MESSAGES, [
            params.at,
            params.queues,
            params.limit,
            new Date(params.at.getTime() + params.visibilityMs),
        ])
        return rows.map(toOutboxRecord)
    }

    /** Marks the message delivered. */
    async complete(id: string): Promise<void> {
        await this.entityManager.query(COMPLETE_MESSAGE, [id])
    }

    /** Schedules the next delivery. */
    async retry(params: RetryMessageParams): Promise<void> {
        await this.entityManager.query(RETRY_MESSAGE, [params.id, params.at, params.error])
    }

    /** Stops delivering the message. */
    async bury(params: BuryMessageParams): Promise<void> {
        await this.entityManager.query(BURY_MESSAGE, [params.id, params.error])
    }
}
