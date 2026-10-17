import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BOOKING_REMINDER_QUEUE } from "@modules/queues/booking-reminder"
import { BookingRemindersService } from "./booking-reminders.service"
import { ENQUEUE_REMINDER_TICK } from "./persistence/booking-reminders.sql"

describe("BookingRemindersService", () => {
    it("sends the scheduled tick envelope to the reminder queue exactly once", async () => {
        const entityManager = mockEntityManager({ query: [ENQUEUE_REMINDER_TICK, [{ msg_id: 1 }]] })
        const moduleRef = await Test.createTestingModule({
            providers: [BookingRemindersService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
        }).compile()

        await expect(moduleRef.get(BookingRemindersService).enqueueTick()).resolves.toBeUndefined()

        expect(entityManager.query).toHaveBeenCalledTimes(1)
        expect(entityManager.query).toHaveBeenCalledWith(ENQUEUE_REMINDER_TICK, [
            BOOKING_REMINDER_QUEUE,
            JSON.stringify({ payload: { tick: true } }),
        ])
    })
})
