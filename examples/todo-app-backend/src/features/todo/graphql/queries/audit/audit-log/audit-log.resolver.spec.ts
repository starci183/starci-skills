import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    AuditLogQuery 
} from "@modules/bussiness/audit/audit-log.query"
import type {
    AuditLogQueryResult 
} from "@modules/bussiness/audit/audit-log.query"
import {
    AuditOperatorRoleNotAuthorizedException 
} from "@modules/shared/exceptions/errors/audit/audit-operator-role-not-authorized"

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
    AuditLogResolver 
} from "./audit-log.resolver"
import {
    AuditLogLineResponse 
} from "./graphql-types/response"

describe("AuditLogResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: AuditLogResolver
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
                    AuditLogResolver,
                    {
                        provide: QueryBus, useValue: queryBus 
                    },
                    {
                        provide: SessionService, useValue: sessionService 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(AuditLogResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("maps every line onto an AuditLogLineResponse, keeping a null target null",
            async () => {
                const at = new Date("2026-09-18T10:00:00.000Z")
                const result: AuditLogQueryResult = {
                    lines: [
                        {
                            at, action: "task.created", target: "task-1" 
                        },
                        {
                            at, action: "login.signed-in", target: null 
                        },
                    ],
                }
                queryBus.execute.mockResolvedValue(result)

                const response = await resolver.auditLog(req("Bearer token-1"))

                expect(response).toEqual([
                    new AuditLogLineResponse(at,
                        "task.created",
                        "task-1"),
                    new AuditLogLineResponse(at,
                        "login.signed-in",
                        null),
                ])
                expect(response.every(r => r instanceof AuditLogLineResponse)).toBe(true)
            })

        it("dispatches an AuditLogQuery with the session actor as personId and no caller-controlled filters",
            async () => {
                queryBus.execute.mockResolvedValue({
                    lines: [] 
                })

                await resolver.auditLog(req("Bearer token-1"))

                expect(sessionService.findActive).toHaveBeenCalledWith("token-1")
                const query = queryBus.execute.mock.calls[0][0]
                expect(query).toBeInstanceOf(AuditLogQuery)
                // The transport never threads a role or action/target filter through: the handler decides the
                // branch from the verified operator claim, so the query carries exactly the authenticated person.
                expect(query.params).toEqual({
                    personId: "person-1" 
                })
            })

        it("returns an empty list when the person has no audit lines",
            async () => {
                queryBus.execute.mockResolvedValue({
                    lines: [] 
                })

                const response = await resolver.auditLog(req("Bearer token-1"))

                expect(response).toEqual([])
            })

        it("refuses a request with no Authorization header before any query runs",
            async () => {
                await expect(resolver.auditLog(req())).rejects.toThrow(SessionNotFoundException)

                expect(sessionService.findActive).toHaveBeenCalledWith("")
                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("propagates SessionExpiredException unchanged",
            async () => {
                await expect(resolver.auditLog(req("Bearer token-expired"))).rejects.toThrow(SessionExpiredException)

                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("propagates AuditOperatorRoleNotAuthorizedException raised inside the query bus unchanged",
            async () => {
                const failure = new AuditOperatorRoleNotAuthorizedException({
                    actor: "person-1" 
                })
                queryBus.execute.mockRejectedValue(failure)

                await expect(resolver.auditLog(req("Bearer token-1"))).rejects.toBe(failure)
            })
    })
