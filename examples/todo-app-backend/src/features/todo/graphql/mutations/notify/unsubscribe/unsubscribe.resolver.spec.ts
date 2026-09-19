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
    UnsubscribeCommand 
} from "@modules/bussiness/notify/unsubscribe.command"

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
    UnsubscribeInput 
} from "./graphql-types/input"
import {
    UnsubscribeResolver 
} from "./unsubscribe.resolver"

describe("UnsubscribeResolver (fr.notify.unsubscribe)",
    () => {
        let moduleRef: TestingModule
        let resolver: UnsubscribeResolver
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
        const input = (channel: string): UnsubscribeInput => Object.assign(new UnsubscribeInput(),
            {
                channel 
            })

        beforeEach(async () => {
            execute = jest.fn()
            findActive = jest.fn()
            moduleRef = await Test.createTestingModule({
                providers: [
                    UnsubscribeResolver,
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
            resolver = moduleRef.get(UnsubscribeResolver)
        })

        afterEach(() => moduleRef.close())

        it("dispatches UnsubscribeCommand for the caller on the requested channel",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockResolvedValue({
                    channel: "push", unsubscribed: true 
                })

                const result = await resolver.unsubscribe(req("tok-1"),
                    input("push"))

                expect(findActive).toHaveBeenCalledWith("tok-1")
                const command = execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(UnsubscribeCommand)
                expect(command.params).toEqual({
                    actorId: "person-1", channel: "push" 
                })
                expect(result).toEqual({
                    channel: "push", unsubscribed: true 
                })
            })

        it("propagates a command-bus refusal untouched",
            async () => {
                findActive.mockResolvedValue(activeSession())
                const failure = new Error("preferences store unavailable")
                execute.mockRejectedValue(failure)

                await expect(resolver.unsubscribe(req("tok-1"),
                    input("email"))).rejects.toBe(failure)
            })

        it("refuses before dispatch when the session is missing or expired",
            async () => {
                findActive.mockRejectedValueOnce(new SessionNotFoundException({
                    reason: "missing-token" 
                }))
                await expect(resolver.unsubscribe(req(),
                    input("email"))).rejects.toThrow(SessionNotFoundException)

                findActive.mockRejectedValueOnce(new SessionExpiredException())
                await expect(resolver.unsubscribe(req("tok-stale"),
                    input("email"))).rejects.toThrow(SessionExpiredException)

                expect(execute).not.toHaveBeenCalled()
            })
    })

describe("UnsubscribeInput validation",
    () => {
        it("rejects an empty channel",
            async () => {
                const bad = Object.assign(new UnsubscribeInput(),
                    {
                        channel: "" 
                    })
                const errors = await validate(bad)
                expect(errors.map((e) => e.property)).toContain("channel")
            })
    })
