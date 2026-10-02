import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectOrderEntityManager } from "@modules/platform/database"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { MINOR_UNITS_PER_POINT } from "./loyalty.contracts"
import type { GrantLoyaltyParams } from "./loyalty.contracts"
import { LoyaltyEntryEntity } from "./persistence/entities/loyalty-entry.entity"
import { SUM_PERSON_POINTS } from "./persistence/loyalty.sql"
import { toPoints } from "./persistence/loyalty.rows"
import type { PointsRow } from "./persistence/loyalty.rows"

/** The inbox source of the paid-order events this service consumes. */
const ORDER_SOURCE = "order-paid-loyalty"

@Injectable()
/**
 * The loyalty ledger of the buyers. `grantForOrder` takes a delivery of `order.paid`: it claims the event in the inbox first,
 * so a redelivery grants nothing twice, then writes one ledger entry of `floor(total / 100)` points for the order. The
 * order id is unique in the ledger, so even a lost claim cannot grant an order twice.
 */
export class LoyaltyService {
    constructor(
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectInbox() private readonly inbox: Inbox,
    ) {}

    /** Records the points of one paid order exactly once; an order that earns no point records nothing. */
    async grantForOrder(params: GrantLoyaltyParams): Promise<void> {
        if (!(await this.inbox.claim(ORDER_SOURCE, params.eventId))) return
        const points = Math.floor(params.totalMinorUnits / MINOR_UNITS_PER_POINT)
        if (points === 0) return
        try {
            await this.entityManager.save(
                LoyaltyEntryEntity,
                this.entityManager.create(LoyaltyEntryEntity, {
                    personId: params.personId,
                    orderId: params.orderId,
                    points,
                    createdAt: this.clock.now(),
                }),
            )
        } catch (error) {
            await this.inbox.release(ORDER_SOURCE, params.eventId)
            throw error
        }
    }

    /** The points a buyer has earned in total. */
    async pointsOf(personId: string): Promise<number> {
        const rows: Array<PointsRow> = await this.entityManager.query(SUM_PERSON_POINTS, [personId])
        return toPoints(rows)
    }
}
