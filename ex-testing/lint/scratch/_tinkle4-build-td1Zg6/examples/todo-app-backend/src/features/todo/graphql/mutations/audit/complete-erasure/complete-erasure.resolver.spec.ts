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
    CompleteErasureCommand 
} from "@modules/bussiness/audit/complete-erasure.command"

import {
    ErasureRequestForbiddenException 
} from "@modules/shared/exceptions/errors/audit/erasure-request-forbidden"
import {
    ErasureRequestInvalidStateException 
} from "@modules/shared/exceptions/errors/audit/erasure-request-invalid-state"
import {
    ErasureRequestNotFoundException 
} from "@modules/shared/exceptions/errors/audit/erasure-request-not-found"
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
    CompleteErasureResolver 
} from "./complete-erasure.resolver"

describe("CompleteErasureResolver (fr.audit.erasure.complete)",
    () => {
        let moduleRef: TestingModule
        let resolver: CompleteErasureResolver
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
                    CompleteErasureResolver,
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
            resolver = moduleRef.get(CompleteErasureResolver)
        })

        afterEach(() => moduleRef.close())

        it("dispatches CompleteErasureCommand with the request id and the caller as callerId",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockResolvedValue({
                    requestId: "er-1", state: "completed" 
                })

                const result = await resolver.completeErasure(req("tok-1"),
                    "er-1")

                expect(findActive).toHaveBeenCalledWith("tok-1")
                const command = execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(CompleteErasureCommand)
                expect(command.params).toEqual({
                    requestId: "er-1", callerId: "person-1" 
                })
                expect(result).toEqual({
                    requestId: "er-1", state: "completed" 
                })
            })

        it("propagates ErasureRequestNotFoundException for a request id that does not resolve",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockRejectedValue(new ErasureRequestNotFoundException({
                    requestId: "er-gone" 
                }))

                await expect(resolver.completeErasure(req("tok-1"),
                    "er-gone")).rejects.toThrow(
                    ErasureRequestNotFoundException,
                )
            })

        it("propagates ErasureRequestForbiddenException when the request's subject is somebody else",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockRejectedValue(new ErasureRequestForbiddenException())

                await expect(resolver.completeErasure(req("tok-1"),
                    "er-other")).rejects.toThrow(
                    ErasureRequestForbiddenException,
                )
            })

        it("propagates ErasureRequestInvalidStateException when the request is not yet verified",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockRejectedValue(
                    new ErasureRequestInvalidStateException({
                        requestId: "er-1", state: "requested", expected: "verified" 
                    }),
                )

                await expect(resolver.completeErasure(req("tok-1"),
                    "er-1")).rejects.toThrow(
                    ErasureRequestInvalidStateException,
                )
            })

        it("refuses before dispatch when the session is missing or expired",
            async () => {
                findActive.mockRejectedValueOnce(new SessionNotFoundException({
                    reason: "missing-token" 
                }))
                await expect(resolver.completeErasure(req(),
                    "er-1")).rejects.toThrow(SessionNotFoundException)

                findActive.mockRejectedValueOnce(new SessionExpiredException())
                await expect(resolver.completeErasure(req("tok-stale"),
                    "er-1")).rejects.toThrow(SessionExpiredException)

                expect(execute).not.toHaveBeenCalled()
            })
    })
