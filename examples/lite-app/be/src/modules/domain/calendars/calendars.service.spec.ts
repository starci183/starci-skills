import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CalendarsService } from "./calendars.service"
import { CalendarsErrorCode } from "./errors/calendars.error"
import { FIND_CALENDARS, FIND_DELIVERY_CALENDAR, INSERT_CALENDARS } from "./persistence/calendars.sql"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [CalendarsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(CalendarsService)
}

describe("CalendarsService", () => {
    describe("calendars", () => {
        it("returns the calendar the principal owns", async () => {
            const em = mockEntityManager({ query: [FIND_CALENDARS, [{ id: "calendar-1" }]] })

            await expect((await build(em)).calendars("person-1", "calendar-1")).resolves.toEqual({ id: "calendar-1" })
            expect(em.query).toHaveBeenCalledWith(FIND_CALENDARS, ["calendar-1", "person-1"])
        })

        it("answers not found for a calendar that is absent or owned by someone else", async () => {
            const em = mockEntityManager({ query: [FIND_CALENDARS, []] })

            await expect((await build(em)).calendars("person-1", "calendar-9")).rejects.toMatchObject({
                code: CalendarsErrorCode.NotFound,
                params: { id: "calendar-9" },
            })
        })
    })

    describe("createCalendar", () => {
        it("inserts one calendar owned by the principal and answers its id", async () => {
            const em = mockEntityManager({ query: [INSERT_CALENDARS, [{ id: "calendar-1" }]] })

            await expect((await build(em)).createCalendar("person-1")).resolves.toEqual({ id: "calendar-1" })
            expect(em.query).toHaveBeenCalledWith(INSERT_CALENDARS, ["person-1"])
        })

        it("answers not created when the insert returns no row", async () => {
            const em = mockEntityManager({ query: [INSERT_CALENDARS, []] })

            await expect((await build(em)).createCalendar("person-1")).rejects.toMatchObject({
                code: CalendarsErrorCode.NotCreated,
            })
        })
    })

    describe("acceptCalendarDelivery", () => {
        it("resolves the delivery target through the transaction manager it is handed", async () => {
            const manager = mockEntityManager({ query: [FIND_DELIVERY_CALENDAR, [{ id: "calendar-1" }]] })

            await expect(
                (await build(mockEntityManager())).acceptCalendarDelivery({ id: "calendar-1" }, manager),
            ).resolves.toBeUndefined()
            expect(manager.query).toHaveBeenCalledWith(FIND_DELIVERY_CALENDAR, ["calendar-1"])
        })

        it("resolves the delivery target through the shared manager when it is handed none", async () => {
            const em = mockEntityManager({ query: [FIND_DELIVERY_CALENDAR, [{ id: "calendar-1" }]] })

            await expect((await build(em)).acceptCalendarDelivery({ id: "calendar-1" })).resolves.toBeUndefined()
            expect(em.query).toHaveBeenCalledWith(FIND_DELIVERY_CALENDAR, ["calendar-1"])
        })

        it("answers not found for a delivery whose calendar does not exist", async () => {
            const manager = mockEntityManager({ query: [FIND_DELIVERY_CALENDAR, []] })

            await expect(
                (await build(mockEntityManager())).acceptCalendarDelivery({ id: "calendar-9" }, manager),
            ).rejects.toMatchObject({ code: CalendarsErrorCode.NotFound, params: { id: "calendar-9" } })
        })
    })
})
