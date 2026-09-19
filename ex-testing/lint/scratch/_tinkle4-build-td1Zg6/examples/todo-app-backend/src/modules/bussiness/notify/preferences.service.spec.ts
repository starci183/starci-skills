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
    PreferencesService 
} from "./preferences.service"

describe("PreferencesService",
    () => {
        let moduleRef: TestingModule
        let service: PreferencesService

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    PreferencesService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakeNotifyEntityManager() 
                    },
                ],
            }).compile()
            service = moduleRef.get(PreferencesService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("data.notify.preference: no row reads as the default (not unsubscribed, no override)",
            async () => {
                const pref = await service.get("person-1",
                    "email")
                expect(pref.unsubscribed).toBe(false)
                expect(pref.digestWindowMinutes).toBeNull()
            })

        it("ac.notify.unsubscribe.honored.suppresses-future-sends: unsubscribing is per person and per channel",
            async () => {
                await service.setUnsubscribed("person-1",
                    "email",
                    true)

                expect(await service.isUnsubscribed("person-1",
                    "email")).toBe(true)
                expect(await service.isUnsubscribed("person-1",
                    "sms")).toBe(false)
                expect(await service.isUnsubscribed("person-2",
                    "email")).toBe(false)
            })

        it("re-subscribing (unsubscribed: false) reverses the suppression",
            async () => {
                await service.setUnsubscribed("person-1",
                    "email",
                    true)
                await service.setUnsubscribed("person-1",
                    "email",
                    false)

                expect(await service.isUnsubscribed("person-1",
                    "email")).toBe(false)
            })

        it("data.notify.preference invariant: at most one row per (personId, channel) - setting unsubscribed preserves an existing digestWindowMinutes",
            async () => {
                await service.setDigestWindowMinutes("person-1",
                    "email",
                    15)
                await service.setUnsubscribed("person-1",
                    "email",
                    true)

                const pref = await service.get("person-1",
                    "email")
                expect(pref.unsubscribed).toBe(true)
                expect(pref.digestWindowMinutes).toBe(15)
            })
    })
