import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    createFakeNotifyEntityManager 
} from "./testing/fake-notify-entity-manager"
import {
    DigestService, AdmitIntoWindowResult 
} from "./digest.service"

describe("DigestService",
    () => {
        let moduleRef: TestingModule
        let service: DigestService

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    DigestService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakeNotifyEntityManager() 
                    },
                ],
            }).compile()
            service = moduleRef.get(DigestService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("ac.notify.digest.window.collapses-into-one-message: a second event before close joins the same group",
            async () => {
                const t0 = new Date("2026-09-18T06:00:00.000Z")
                const t1 = new Date("2026-09-18T06:05:00.000Z") // 5 minutes later, still inside the 10-minute default window

                const first = await service.admit("person-1",
                    "email",
                    t0)
                const second = await service.admit("person-1",
                    "email",
                    t1)

                expect(first.opened).toBe(true)
                expect(second.opened).toBe(false)
                expect(second.windowId).toBe(first.windowId)
            })

        it("ac.notify.digest.window.collapses-into-one-message: flushing before close returns nothing",
            async () => {
                const t0 = new Date("2026-09-18T06:00:00.000Z")
                const beforeClose = new Date("2026-09-18T06:05:00.000Z")

                const opened = await service.admit("person-1",
                    "email",
                    t0)
                const flushed = await service.flush(opened.windowId,
                    beforeClose)

                expect(flushed).toBeNull()
            })

        it("ac.notify.digest.window.collapses-into-one-message: flushing at close returns the group once, in order",
            async () => {
                const t0 = new Date("2026-09-18T06:00:00.000Z")
                const atClose = (opened: AdmitIntoWindowResult) => new Date(opened.closesAt.getTime())

                const opened = await service.admit("person-1",
                    "email",
                    t0)
                const closeTime = atClose(opened)

                const flushed = await service.flush(opened.windowId,
                    closeTime)
                expect(flushed).toEqual({
                    windowId: opened.windowId, personId: "person-1", channel: "email" 
                })

                const flushedAgain = await service.flush(opened.windowId,
                    closeTime)
                expect(flushedAgain).toBeNull()
            })

        it("fr.notify.digest's exception flow: a window that has already closed is not joined by a later admission",
            async () => {
                const t0 = new Date("2026-09-18T06:00:00.000Z")
                const afterClose = new Date("2026-09-18T06:11:00.000Z") // past the 10-minute default window

                const opened = await service.admit("person-1",
                    "email",
                    t0)
                const later = await service.admit("person-1",
                    "email",
                    afterClose)

                expect(later.opened).toBe(true)
                expect(later.windowId).not.toBe(opened.windowId)
            })

        it("a preference override changes the window length",
            async () => {
                const t0 = new Date("2026-09-18T06:00:00.000Z")
                const opened = await service.admit("person-1",
                    "email",
                    t0,
                    1)
                expect(opened.closesAt.getTime() - t0.getTime()).toBe(60_000)
            })
    })
