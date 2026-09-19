import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    ExportMyDataQuery 
} from "@modules/bussiness/audit/export-my-data.query"
import type {
    ExportMyDataQueryResult 
} from "@modules/bussiness/audit/export-my-data.query"

import {
    SessionExpiredException 
} from "@modules/shared/exceptions/errors/session/session-expired"
import {
    SessionNotFoundException 
} from "@modules/shared/exceptions/errors/session/session-not-found"
import {
    SessionRecord 
} from "@modules/bussiness/session/types/session-record"
import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    ExportMyDataResolver 
} from "./export-my-data.resolver"
import {
    ExportedLineResponse 
} from "./graphql-types/response"

describe("ExportMyDataResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: ExportMyDataResolver
        let queryBus: { execute: jest.Mock }
        let sessionService: { findActive: jest.Mock }

        const req = (authorization?: string): GraphqlRequestLike => ({
            headers: authorization === undefined ? {
            } : {
                authorization 
            },
        })

        beforeEach(async () => {
            queryBus = {
                execute: jest.fn() 
            }
            sessionService = {
                findActive: jest.fn(async (token: string) => {
                    if (token === "token-expired") throw new SessionExpiredException({
                    })
                    if (!token) throw new SessionNotFoundException({
                        reason: "missing-token" 
                    })
                    return new SessionRecord(token,
                        "person-1",
                        new Date(),
                        new Date(Date.now() + 60_000))
                }),
            }
            moduleRef = await Test.createTestingModule({
                providers: [
                    ExportMyDataResolver,
                    {
                        provide: QueryBus, useValue: queryBus 
                    },
                    {
                        provide: SessionService, useValue: sessionService 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(ExportMyDataResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("maps every decrypted line onto an ExportedLineResponse",
            async () => {
                const at = new Date("2026-09-18T10:00:00.000Z")
                const result: ExportMyDataQueryResult = {
                    lines: [{
                        at, action: "task.created", target: "task-1" 
                    }],
                }
                queryBus.execute.mockResolvedValue(result)

                const response = await resolver.exportMyData(req("Bearer token-1"))

                expect(response).toEqual([new ExportedLineResponse(at,
                    "task.created",
                    "task-1")])
                expect(response[0]).toBeInstanceOf(ExportedLineResponse)
            })

        it("dispatches an ExportMyDataQuery with the session actor as personId",
            async () => {
                queryBus.execute.mockResolvedValue({
                    lines: [] 
                })

                await resolver.exportMyData(req("Bearer token-1"))

                expect(sessionService.findActive).toHaveBeenCalledWith("token-1")
                const query = queryBus.execute.mock.calls[0][0]
                expect(query).toBeInstanceOf(ExportMyDataQuery)
                expect(query.params).toEqual({
                    personId: "person-1" 
                })
            })

        it("returns an empty list once a completed erasure has destroyed the caller key",
            async () => {
                queryBus.execute.mockResolvedValue({
                    lines: [] 
                })

                const response = await resolver.exportMyData(req("Bearer token-1"))

                expect(response).toEqual([])
            })

        it("refuses a request with no Authorization header before any query runs",
            async () => {
                await expect(resolver.exportMyData(req())).rejects.toThrow(SessionNotFoundException)

                expect(sessionService.findActive).toHaveBeenCalledWith("")
                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("propagates SessionExpiredException unchanged",
            async () => {
                await expect(resolver.exportMyData(req("Bearer token-expired"))).rejects.toThrow(SessionExpiredException)

                expect(queryBus.execute).not.toHaveBeenCalled()
            })
    })
