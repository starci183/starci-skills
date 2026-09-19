import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    ListCollaboratorsQuery 
} from "@modules/bussiness/share/list-collaborators.query"
import type {
    ListCollaboratorsQueryResult 
} from "@modules/bussiness/share/list-collaborators.query"

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
    ShareForbiddenException 
} from "@modules/shared/exceptions/errors/share/forbidden"
import {
    TaskNotFoundException 
} from "@modules/shared/exceptions/errors/task/task-not-found"

import {
    GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    CollaboratorsResolver 
} from "./collaborators.resolver"
import {
    CollaboratorResponse 
} from "./graphql-types/response"

describe("CollaboratorsResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: CollaboratorsResolver
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
                    CollaboratorsResolver,
                    {
                        provide: QueryBus, useValue: queryBus 
                    },
                    {
                        provide: SessionService, useValue: sessionService 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(CollaboratorsResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("maps every collaborator onto a CollaboratorResponse",
            async () => {
                const result: ListCollaboratorsQueryResult = {
                    collaborators: [
                        {
                            invitationId: "inv-1", email: "a@todo.dev", role: "editor", status: "accepted" 
                        },
                        {
                            invitationId: "inv-2", email: "b@todo.dev", role: "viewer", status: "pending" 
                        },
                    ],
                }
                queryBus.execute.mockResolvedValue(result)

                const response = await resolver.collaborators(req("Bearer token-1"),
                    "task-1")

                expect(response).toEqual([
                    new CollaboratorResponse("inv-1",
                        "a@todo.dev",
                        "editor",
                        "accepted"),
                    new CollaboratorResponse("inv-2",
                        "b@todo.dev",
                        "viewer",
                        "pending"),
                ])
                expect(response.every(r => r instanceof CollaboratorResponse)).toBe(true)
            })

        it("threads the taskId argument and the session actor into the query params",
            async () => {
                queryBus.execute.mockResolvedValue({
                    collaborators: [] 
                })

                await resolver.collaborators(req("Bearer token-1"),
                    "task-1")

                expect(sessionService.findActive).toHaveBeenCalledWith("token-1")
                const query = queryBus.execute.mock.calls[0][0]
                expect(query).toBeInstanceOf(ListCollaboratorsQuery)
                expect(query.params).toEqual({
                    actorId: "person-1", taskId: "task-1" 
                })
            })

        it("returns an empty list for a task with no collaborators",
            async () => {
                queryBus.execute.mockResolvedValue({
                    collaborators: [] 
                })

                const response = await resolver.collaborators(req("Bearer token-1"),
                    "task-1")

                expect(response).toEqual([])
            })

        it("refuses a request with no Authorization header before any query runs",
            async () => {
                await expect(resolver.collaborators(req(),
                    "task-1")).rejects.toThrow(SessionNotFoundException)

                expect(sessionService.findActive).toHaveBeenCalledWith("")
                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("propagates SessionExpiredException unchanged",
            async () => {
                await expect(resolver.collaborators(req("Bearer token-expired"),
                    "task-1")).rejects.toThrow(SessionExpiredException)

                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("propagates TaskNotFoundException raised inside the query bus unchanged",
            async () => {
                const failure = new TaskNotFoundException()
                queryBus.execute.mockRejectedValue(failure)

                await expect(resolver.collaborators(req("Bearer token-1"),
                    "task-missing")).rejects.toBe(failure)
            })

        it("propagates ShareForbiddenException for an actor who is neither owner nor collaborator",
            async () => {
                const failure = new ShareForbiddenException()
                queryBus.execute.mockRejectedValue(failure)

                await expect(resolver.collaborators(req("Bearer token-1"),
                    "task-foreign")).rejects.toBe(failure)
            })
    })
