import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    ListTasksQuery 
} from "@modules/bussiness/task/list-tasks.query"
import type {
    ListTasksQueryResult 
} from "@modules/bussiness/task/list-tasks.query"

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
    ListTasksResolver 
} from "./list-tasks.resolver"
import {
    TaskSummaryResponse 
} from "./graphql-types/response"

describe("ListTasksResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: ListTasksResolver
        let queryBus: { execute: jest.Mock }
        let sessionService: { findActive: jest.Mock }

        const req = (authorization?: string | Array<string>): GraphqlRequestLike => ({
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
                    ListTasksResolver,
                    {
                        provide: QueryBus, useValue: queryBus 
                    },
                    {
                        provide: SessionService, useValue: sessionService 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(ListTasksResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("maps every result row onto a TaskSummaryResponse",
            async () => {
                const result: ListTasksQueryResult = {
                    tasks: [
                        {
                            taskId: "task-1", title: "One", complete: false 
                        },
                        {
                            taskId: "task-2", title: "Two", complete: true 
                        },
                    ],
                }
                queryBus.execute.mockResolvedValue(result)

                const response = await resolver.tasks(req("Bearer token-1"))

                expect(response).toEqual([
                    new TaskSummaryResponse("task-1",
                        "One",
                        false),
                    new TaskSummaryResponse("task-2",
                        "Two",
                        true),
                ])
                expect(response.every(r => r instanceof TaskSummaryResponse)).toBe(true)
            })

        it("dispatches a ListTasksQuery whose ownerId is the session actor - never a caller-supplied person",
            async () => {
                queryBus.execute.mockResolvedValue({
                    tasks: [] 
                })

                await resolver.tasks(req("Bearer token-1"))

                expect(sessionService.findActive).toHaveBeenCalledWith("token-1")
                expect(queryBus.execute).toHaveBeenCalledTimes(1)
                const query = queryBus.execute.mock.calls[0][0]
                expect(query).toBeInstanceOf(ListTasksQuery)
                expect(query.params).toEqual({
                    ownerId: "person-1" 
                })
            })

        it("uses the first value of a multi-valued Authorization header",
            async () => {
                queryBus.execute.mockResolvedValue({
                    tasks: [] 
                })

                await resolver.tasks(req(["Bearer token-1",
                    "Bearer token-2"]))

                expect(sessionService.findActive).toHaveBeenCalledWith("token-1")
            })

        it("returns an empty list when the owner has no tasks",
            async () => {
                queryBus.execute.mockResolvedValue({
                    tasks: [] 
                })

                const response = await resolver.tasks(req("Bearer token-1"))

                expect(response).toEqual([])
            })

        it("refuses a request with no Authorization header before any query runs",
            async () => {
                await expect(resolver.tasks(req())).rejects.toThrow(SessionNotFoundException)

                expect(sessionService.findActive).toHaveBeenCalledWith("")
                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("refuses a malformed Authorization header (no Bearer prefix) the same way",
            async () => {
                await expect(resolver.tasks(req("not-a-bearer-token"))).rejects.toThrow(SessionNotFoundException)

                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("propagates SessionExpiredException unchanged",
            async () => {
                await expect(resolver.tasks(req("Bearer token-expired"))).rejects.toThrow(SessionExpiredException)

                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("propagates a domain error raised inside the query bus unchanged",
            async () => {
                const failure = new SessionNotFoundException()
                queryBus.execute.mockRejectedValue(failure)

                await expect(resolver.tasks(req("Bearer token-1"))).rejects.toBe(failure)
            })
    })
