import {
    Test 
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
import {
    NotificationPreferencesQuery 
} from "./notification-preferences.query"
import {
    NotificationPreferencesHandler 
} from "./notification-preferences.handler"

describe("NotificationPreferencesHandler",
    () => {
        const build = async () => {
            const moduleRef = await Test.createTestingModule({
                providers: [
                    NotificationPreferencesHandler,
                    PreferencesService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakeNotifyEntityManager() 
                    },
                ],
            }).compile()
            return {
                moduleRef,
                preferences: moduleRef.get(PreferencesService),
                handler: moduleRef.get(NotificationPreferencesHandler),
            }
        }

        it("data.notify.preference: reads back the default when no preference has ever been written",
            async () => {
                const { moduleRef, handler } = await build()
                try {
                    const result = await handler.execute(new NotificationPreferencesQuery({
                        actorId: "owner-1", channel: "email" 
                    }))
                    expect(result).toEqual({
                        channel: "email", unsubscribed: false, digestWindowMinutes: null 
                    })
                } finally {
                    await moduleRef.close()
                }
            })

        it("reads back a written preference",
            async () => {
                const { moduleRef, preferences, handler } = await build()
                try {
                    await preferences.update("owner-1",
                        "email",
                        {
                            unsubscribed: true, digestWindowMinutes: 5 
                        })
                    const result = await handler.execute(new NotificationPreferencesQuery({
                        actorId: "owner-1", channel: "email" 
                    }))
                    expect(result).toEqual({
                        channel: "email", unsubscribed: true, digestWindowMinutes: 5 
                    })
                } finally {
                    await moduleRef.close()
                }
            })
    })
