import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectOrderEntityManager } from "@modules/platform/database"
import type { Inbox } from "@modules/platform/inbox"
import { CLAIM_SAGA_EVENT, RELEASE_SAGA_EVENT } from "./persistence/saga.sql"

@Injectable()
/** The Inbox port over the saga's own claims table: the unique (source, event id) pair decides who takes an event first. */
export class SagaInbox implements Inbox {
    constructor(
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** True for the first claim of the event, false for every later one. */
    async claim(source: string, eventId: string): Promise<boolean> {
        const rows: Array<object> = await this.entityManager.query(CLAIM_SAGA_EVENT, [
            source,
            eventId,
            this.clock.now(),
        ])
        return rows.length > 0
    }

    /** Deletes the claim so a redelivery is processed again. */
    async release(source: string, eventId: string): Promise<void> {
        await this.entityManager.query(RELEASE_SAGA_EVENT, [source, eventId])
    }
}
