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
    UnsubscribeCommand 
} from "./unsubscribe.command"
import {
    UnsubscribeHandler 
} from "./unsubscribe.handler"

describe("UnsubscribeHandler",
    () => {
        it("ac.notify.unsubscribe.honored.suppresses-future-sends: sets unsubscribed for the actor and channel",
            async () => {
                const moduleRef = await Test.createTestingModule({
                    providers: [
                        UnsubscribeHandler,
                        PreferencesService,
                        {
                            provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakeNotifyEntityManager() 
                        },
                    ],
                }).compile()
                try {
                    const preferences = moduleRef.get(PreferencesService)
                    const handler = moduleRef.get(UnsubscribeHandler)

                    const result = await handler.execute(new UnsubscribeCommand({
                        actorId: "owner-1", channel: "email" 
                    }))

                    expect(result).toEqual({
                        channel: "email", unsubscribed: true 
                    })
                    expect(await preferences.isUnsubscribed("owner-1",
                        "email")).toBe(true)
                    expect(await preferences.isUnsubscribed("owner-2",
                        "email")).toBe(false)
                } finally {
                    await moduleRef.close()
                }
            })
    })
