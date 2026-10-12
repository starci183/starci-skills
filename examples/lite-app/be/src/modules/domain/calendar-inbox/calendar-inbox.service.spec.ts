import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { CalendarsService } from "@modules/domain/calendars"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CalendarInboxService } from "./calendar-inbox.service"
import { COMPLETE_CALENDAR_INBOX, INSERT_CALENDAR_INBOX } from "./persistence/calendar-inbox.sql"

const build = async (claimed: ReadonlyArray<{ id: string }>) => {
    const tx = fakeTransaction(
        mockEntityManager({
            query: [
                [INSERT_CALENDAR_INBOX, claimed],
                [COMPLETE_CALENDAR_INBOX, claimed],
            ],
        }),
    )
    const calendars = mock<CalendarsService>()
    calendars.acceptCalendarDelivery.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            CalendarInboxService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CalendarsService, useValue: calendars },
        ],
    }).compile()
    return { inbox: moduleRef.get(CalendarInboxService), tx, calendars }
}

describe("CalendarInboxService", () => {
    describe("acceptCalendarDelivery", () => {
        it("claims a new delivery, runs the calendar intake in the transaction and marks it complete", async () => {
            const { inbox, tx, calendars } = await build([{ id: "inbox-1" }])

            await inbox.acceptCalendarDelivery("delivery-1", { id: "calendar-1" })

            expect(tx.commits).toBe(1)
            expect(calendars.acceptCalendarDelivery).toHaveBeenCalledTimes(1)
            expect(calendars.acceptCalendarDelivery.mock.calls[0]?.[0]).toEqual({ id: "calendar-1" })
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_CALENDAR_INBOX, [
                "calendar",
                "delivery-1",
                JSON.stringify({ id: "calendar-1" }),
            ])
            expect(tx.em.query).toHaveBeenCalledWith(COMPLETE_CALENDAR_INBOX, ["inbox-1"])
        })

        it("acknowledges a duplicate delivery without running the calendar intake again", async () => {
            const { inbox, tx, calendars } = await build([])

            await inbox.acceptCalendarDelivery("delivery-1", { id: "calendar-1" })

            expect(tx.commits).toBe(1)
            expect(calendars.acceptCalendarDelivery).not.toHaveBeenCalled()
        })
    })
})
