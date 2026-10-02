import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectBillingEntityManager } from "@modules/platform/database"
import type { EntityManager } from "typeorm"
import type { Inbox } from "./inbox.port"
import { CLAIM_EVENT, RELEASE_EVENT } from "./persistence/inbox.sql"

@Injectable()
/** The Inbox adapter over the claims table: the unique (source, event id) pair decides who claims first. */
export class PostgresInbox implements Inbox {
    constructor(
        @InjectBillingEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** True for the first claim of the event, false for every later one. */
    async claim(source: string, eventId: string): Promise<boolean> {
        const rows: Array<object> = await this.entityManager.query(CLAIM_EVENT, [source, eventId, this.clock.now()])
        return rows.length > 0
    }

    /** Deletes the claim so a redelivery is processed again. */
    async release(source: string, eventId: string): Promise<void> {
        await this.entityManager.query(RELEASE_EVENT, [source, eventId])
    }
}
