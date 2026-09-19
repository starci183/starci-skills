import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    SessionRecord 
} from "@modules/bussiness/session/types/session-record"
import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    RequestErasureCommand 
} from "@modules/bussiness/audit/request-erasure.command"

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
    RequestErasureResolver 
} from "./request-erasure.resolver"

describe("RequestErasureResolver (fr.audit.erasure.request)",
    () => {
        let moduleRef: TestingModule
        let resolver: RequestErasureResolver
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

        beforeEach(async () => {
            execute = jest.fn()
            findActive = jest.fn()
            moduleRef = await Test.createTestingModule({
                providers: [
                    RequestErasureResolver,
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
            resolver = moduleRef.get(RequestErasureResolver)
        })

        afterEach(() => moduleRef.close())

        it("requests erasure only for the caller: the session personId is the command subject",
            async () => {
                findActive.mockResolvedValue(activeSession("person-7"))
                execute.mockResolvedValue({
                    requestId: "er-1", state: "requested" 
                })

                const result = await resolver.requestErasure(req("tok-1"))

                expect(findActive).toHaveBeenCalledWith("tok-1")
                const command = execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(RequestErasureCommand)
                expect(command.params).toEqual({
                    personId: "person-7" 
                })
                expect(result).toEqual({
                    requestId: "er-1", state: "requested" 
                })
            })

        it("propagates a command-bus failure untouched",
            async () => {
                findActive.mockResolvedValue(activeSession())
                const failure = new Error("audit store unavailable")
                execute.mockRejectedValue(failure)

                await expect(resolver.requestErasure(req("tok-1"))).rejects.toBe(failure)
            })

        it("refuses before dispatch when the session is missing or expired",
            async () => {
                findActive.mockRejectedValueOnce(new SessionNotFoundException({
                    reason: "missing-token" 
                }))
                await expect(resolver.requestErasure(req())).rejects.toThrow(SessionNotFoundException)

                findActive.mockRejectedValueOnce(new SessionExpiredException())
                await expect(resolver.requestErasure(req("tok-stale"))).rejects.toThrow(SessionExpiredException)

                expect(execute).not.toHaveBeenCalled()
            })
    })
