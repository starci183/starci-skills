import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    validate 
} from "class-validator"
import {
    SessionRecord 
} from "@modules/bussiness/session/types/session-record"
import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    UpdateNotificationPreferencesCommand 
} from "@modules/bussiness/notify/update-notification-preferences.command"

import {
    SessionExpiredException 
} from "@modules/shared/exceptions/errors/session/session-expired"
import {
    SessionNotFoundException 
} from "@modules/shared/exceptions/errors/session/session-not-found"

import {
    GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    UpdateNotificationPreferencesInput 
} from "./graphql-types/input"
import {
    UpdateNotificationPreferencesResolver 
} from "./update-notification-preferences.resolver"

describe("UpdateNotificationPreferencesResolver (fr.notify.unsubscribe / data.notify.preference)",
    () => {
        let moduleRef: TestingModule
        let resolver: UpdateNotificationPreferencesResolver
        let execute: jest.Mock
        let findActive: jest.Mock

        const req = (token?: string): GraphqlRequestLike => ({
            headers: token === undefined ? {
            } : {
                authorization: `Bearer ${token}` 
            },
        })
        const activeSession = (personId = "person-1") =>
            new SessionRecord("tok-1",
                personId,
                new Date(),
                new Date(Date.now() + 60_000))
        const input = (overrides: Partial<UpdateNotificationPreferencesInput>): UpdateNotificationPreferencesInput =>
            Object.assign(new UpdateNotificationPreferencesInput(),
                {
                    channel: "email", ...overrides 
                })

        beforeEach(async () => {
            execute = jest.fn()
            findActive = jest.fn()
            moduleRef = await Test.createTestingModule({
                providers: [
                    UpdateNotificationPreferencesResolver,
                    {
                        provide: CommandBus, useValue: {
                            execute 
                        } 
                    },
                    {
                        provide: SessionService, useValue: {
                            findActive 
                        } 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(UpdateNotificationPreferencesResolver)
        })

        afterEach(() => moduleRef.close())

        it("dispatches the command with caller actorId and every preference field the input carries",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockResolvedValue({
                    channel: "email", unsubscribed: true, digestWindowMinutes: 60 
                })

                const result = await resolver.updateNotificationPreferences(
                    req("tok-1"),
                    input({
                        unsubscribed: true, digestWindowMinutes: 60 
                    }),
                )

                expect(findActive).toHaveBeenCalledWith("tok-1")
                const command = execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(UpdateNotificationPreferencesCommand)
                expect(command.params).toEqual({
                    actorId: "person-1",
                    channel: "email",
                    unsubscribed: true,
                    digestWindowMinutes: 60,
                })
                expect(result).toEqual({
                    channel: "email", unsubscribed: true, digestWindowMinutes: 60 
                })
            })

        it("forwards a partial patch with omitted fields left undefined for the handler to keep",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockResolvedValue({
                    channel: "email", unsubscribed: false, digestWindowMinutes: null 
                })

                const result = await resolver.updateNotificationPreferences(req("tok-1"),
                    input({
                    }))

                expect(execute.mock.calls[0][0].params).toEqual({
                    actorId: "person-1",
                    channel: "email",
                    unsubscribed: undefined,
                    digestWindowMinutes: undefined,
                })
                expect(result.digestWindowMinutes).toBeNull()
            })

        it("refuses before dispatch when the session is missing or expired",
            async () => {
                findActive.mockRejectedValueOnce(new SessionNotFoundException({
                    reason: "missing-token" 
                }))
                await expect(resolver.updateNotificationPreferences(req(),
                    input({
                    }))).rejects.toThrow(
                    SessionNotFoundException,
                )

                findActive.mockRejectedValueOnce(new SessionExpiredException())
                await expect(resolver.updateNotificationPreferences(req("tok-stale"),
                    input({
                    }))).rejects.toThrow(
                    SessionExpiredException,
                )

                expect(execute).not.toHaveBeenCalled()
            })
    })

describe("UpdateNotificationPreferencesInput validation",
    () => {
        const input = (overrides: Partial<UpdateNotificationPreferencesInput>): UpdateNotificationPreferencesInput =>
            Object.assign(new UpdateNotificationPreferencesInput(),
                {
                    channel: "email", ...overrides 
                })
        const invalidProperties = async (value: UpdateNotificationPreferencesInput) =>
            (await validate(value)).map((e) => e.property)

        it("accepts a channel-only patch",
            async () => {
                expect(await invalidProperties(input({
                }))).toEqual([])
            })

        it("rejects an empty channel and a non-positive digest window",
            async () => {
                expect(await invalidProperties(input({
                    channel: "", digestWindowMinutes: 0 
                }))).toEqual(
                    expect.arrayContaining(["channel",
                        "digestWindowMinutes"]),
                )
            })
    })
