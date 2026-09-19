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
    UpdateNotificationPreferencesCommand 
} from "./update-notification-preferences.command"
import {
    UpdateNotificationPreferencesHandler 
} from "./update-notification-preferences.handler"

describe("UpdateNotificationPreferencesHandler",
    () => {
        const build = async () => {
            const moduleRef = await Test.createTestingModule({
                providers: [
                    UpdateNotificationPreferencesHandler,
                    PreferencesService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakeNotifyEntityManager() 
                    },
                ],
            }).compile()
            return {
                moduleRef, handler: moduleRef.get(UpdateNotificationPreferencesHandler) 
            }
        }

        it("sets the digest window without touching unsubscribed",
            async () => {
                const { moduleRef, handler } = await build()
                try {
                    const result = await handler.execute(
                        new UpdateNotificationPreferencesCommand({
                            actorId: "owner-1", channel: "email", digestWindowMinutes: 15 
                        }),
                    )
                    expect(result).toEqual({
                        channel: "email", unsubscribed: false, digestWindowMinutes: 15 
                    })
                } finally {
                    await moduleRef.close()
                }
            })

        it("a later call that only sets unsubscribed keeps the earlier digestWindowMinutes",
            async () => {
                const { moduleRef, handler } = await build()
                try {
                    await handler.execute(new UpdateNotificationPreferencesCommand({
                        actorId: "owner-1", channel: "email", digestWindowMinutes: 15 
                    }))
                    const result = await handler.execute(new UpdateNotificationPreferencesCommand({
                        actorId: "owner-1", channel: "email", unsubscribed: true 
                    }))
                    expect(result).toEqual({
                        channel: "email", unsubscribed: true, digestWindowMinutes: 15 
                    })
                } finally {
                    await moduleRef.close()
                }
            })
    })
