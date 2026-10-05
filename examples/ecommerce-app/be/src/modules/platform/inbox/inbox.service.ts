import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { EntityManager } from "typeorm"
import { InjectClaimManagers } from "./inbox.decorators"
import type { Inbox } from "./inbox.port"
import { CLAIM_EVENT, RELEASE_EVENT } from "./persistence/inbox.sql"

@Injectable()
/** The Inbox adapter over the claims table: the unique (source, event id) pair decides who claims first. */
export class PostgresInbox implements Inbox {
    constructor(
        @InjectClaimManagers() private readonly managers: readonly [EntityManager],
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Claims through the caller transaction when supplied, otherwise through the app's configured manager. */
    async claim(source: string, eventId: string, tx?: EntityManager): Promise<boolean> {
        const manager = tx ?? this.managers[0]
        const rows: Array<object> = await manager.query(CLAIM_EVENT, [source, eventId, this.clock.now()])
        return rows.length > 0
    }

    /** Deletes the claim so a redelivery is processed again. */
    async release(source: string, eventId: string): Promise<void> {
        const [manager] = this.managers
        await manager.query(RELEASE_EVENT, [source, eventId])
    }
}
