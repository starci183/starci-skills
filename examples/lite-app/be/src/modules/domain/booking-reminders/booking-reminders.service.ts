import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { BOOKING_REMINDER_QUEUE } from "@modules/queues/booking-reminder"
import { ENQUEUE_REMINDER_TICK } from "./persistence/booking-reminders.sql"

@Injectable()
/** The manual counterpart of pg_cron's tick; it only enqueues, while the reminder job owns the catch-up work. */
export class BookingRemindersService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Enqueues the same tick envelope as the scheduled SQL job through the existing app-owned queue door. */
    async enqueueTick(): Promise<void> {
        await this.entityManager.query(ENQUEUE_REMINDER_TICK, [
            BOOKING_REMINDER_QUEUE,
            JSON.stringify({ payload: { tick: true } }),
        ])
    }
}
