import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    NotificationPreferencesQuery 
} from "@modules/bussiness/notify/notification-preferences.query"
import type {
    NotificationPreferencesQueryResult 
} from "@modules/bussiness/notify/notification-preferences.query"

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
    PostgresPrimaryUnavailableException 
} from "@modules/shared/exceptions/errors/postgres/postgres-primary-unavailable"

import {
    GraphqlRequestLike 
} from "../../../session-actor.adapter"
import {
    NotificationPreferencesResolver 
} from "./notification-preferences.resolver"
import {
    NotificationPreferencesResponse 
} from "./graphql-types/response"

describe("NotificationPreferencesResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: NotificationPreferencesResolver
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
                    NotificationPreferencesResolver,
                    {
                        provide: QueryBus, useValue: queryBus 
                    },
                    {
                        provide: SessionService, useValue: sessionService 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(NotificationPreferencesResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("maps the preferences result onto a NotificationPreferencesResponse",
            async () => {
                const result: NotificationPreferencesQueryResult = {
                    channel: "email", unsubscribed: true, digestWindowMinutes: 30 
                }
                queryBus.execute.mockResolvedValue(result)

                const response = await resolver.notificationPreferences(req("Bearer token-1"),
                    "email")

                expect(response).toEqual(new NotificationPreferencesResponse("email",
                    true,
                    30))
                expect(response).toBeInstanceOf(NotificationPreferencesResponse)
            })

        it("threads the caller-supplied channel and the session actor into the query params",
            async () => {
                queryBus.execute.mockResolvedValue({
                    channel: "email", unsubscribed: false, digestWindowMinutes: null 
                })

                await resolver.notificationPreferences(req("Bearer token-1"),
                    "email")

                expect(sessionService.findActive).toHaveBeenCalledWith("token-1")
                const query = queryBus.execute.mock.calls[0][0]
                expect(query).toBeInstanceOf(NotificationPreferencesQuery)
                expect(query.params).toEqual({
                    actorId: "person-1", channel: "email" 
                })
            })

        it("reads back the default (not unsubscribed, no digest window) when no row exists",
            async () => {
                queryBus.execute.mockResolvedValue({
                    channel: "email", unsubscribed: false, digestWindowMinutes: null 
                })

                const response = await resolver.notificationPreferences(req("Bearer token-1"),
                    "email")

                expect(response).toEqual(new NotificationPreferencesResponse("email",
                    false,
                    null))
            })

        it("refuses a request with no Authorization header before any query runs",
            async () => {
                await expect(resolver.notificationPreferences(req(),
                    "email")).rejects.toThrow(SessionNotFoundException)

                expect(sessionService.findActive).toHaveBeenCalledWith("")
                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("propagates SessionExpiredException unchanged",
            async () => {
                await expect(resolver.notificationPreferences(req("Bearer token-expired"),
                    "email")).rejects.toThrow(SessionExpiredException)

                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("propagates an infrastructure failure raised inside the query bus unchanged",
            async () => {
                const failure = new PostgresPrimaryUnavailableException({
                    reason: "connection refused" 
                })
                queryBus.execute.mockRejectedValue(failure)

                await expect(resolver.notificationPreferences(req("Bearer token-1"),
                    "email")).rejects.toBe(failure)
            })
    })
