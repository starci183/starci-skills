import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    TaskCountsQuery,
} from "@modules/domain/task/index"
import type {
    TaskCountsQueryResult,
} from "@modules/domain/task/index"

import {
    SessionExpiredException,
} from "@modules/domain/session/index"
import {
    SessionNotFoundException,
} from "@modules/domain/session/index"
import {
    SessionRecord,
} from "@modules/domain/session/index"
import {
    SessionService,
} from "@modules/domain/session/index"

import {
    GraphqlRequestLike,
} from "../../../../../application/session-actor.adapter"
import {
    TaskCountsResolver 
} from "./task-counts.resolver"
import {
    TaskCountsResponse 
} from "./graphql-types/response"

/** The session tokens this spec treats as expired: looked up by membership, never compared for equality. */
const EXPIRED_TOKENS = new Set(["token-expired"])

describe("TaskCountsResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: TaskCountsResolver
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
                    if (EXPIRED_TOKENS.has(token)) throw new SessionExpiredException({
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
                    TaskCountsResolver,
                    {
                        provide: QueryBus, useValue: queryBus 
                    },
                    {
                        provide: SessionService, useValue: sessionService 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(TaskCountsResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("maps the counts result onto a TaskCountsResponse",
            async () => {
                const result: TaskCountsQueryResult = {
                    open: 3, complete: 7 
                }
                queryBus.execute.mockResolvedValue(result)

                const response = await resolver.taskCounts(req("Bearer token-1"))

                expect(response).toEqual(new TaskCountsResponse(3,
                    7))
                expect(response).toBeInstanceOf(TaskCountsResponse)
            })

        it("counts the session actor only - the query shape leaves no room for a caller-supplied person",
            async () => {
                queryBus.execute.mockResolvedValue({
                    open: 0, complete: 0 
                })

                await resolver.taskCounts(req("Bearer token-1"))

                expect(sessionService.findActive).toHaveBeenCalledWith("token-1")
                const query = queryBus.execute.mock.calls[0][0]
                expect(query).toBeInstanceOf(TaskCountsQuery)
                expect(query.params).toEqual({
                    ownerId: "person-1" 
                })
            })

        it("returns zero counts for an owner with no tasks",
            async () => {
                queryBus.execute.mockResolvedValue({
                    open: 0, complete: 0 
                })

                const response = await resolver.taskCounts(req("Bearer token-1"))

                expect(response).toEqual(new TaskCountsResponse(0,
                    0))
            })

        it("refuses a request with no Authorization header before any query runs",
            async () => {
                await expect(resolver.taskCounts(req())).rejects.toThrow(SessionNotFoundException)

                expect(sessionService.findActive).toHaveBeenCalledWith("")
                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("propagates SessionExpiredException unchanged",
            async () => {
                await expect(resolver.taskCounts(req("Bearer token-expired"))).rejects.toThrow(SessionExpiredException)

                expect(queryBus.execute).not.toHaveBeenCalled()
            })
    })
