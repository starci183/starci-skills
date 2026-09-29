import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    QueryBus 
} from "@nestjs/cqrs"
import {
    RecurRuleForbiddenException,
} from "@modules/domain/recur/index"
import {
    RecurRuleNotFoundException,
} from "@modules/domain/recur/index"
import {
    UpcomingOccurrencesQuery,
} from "@modules/domain/recur/index"
import type {
    UpcomingOccurrencesQueryResult,
} from "@modules/domain/recur/index"

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
    UpcomingOccurrencesResolver 
} from "./upcoming-occurrences.resolver"
import {
    MaterialisedOccurrenceResponse, UpcomingOccurrencesResponse 
} from "./graphql-types/response"

describe("UpcomingOccurrencesResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: UpcomingOccurrencesResolver
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
                    UpcomingOccurrencesResolver,
                    {
                        provide: QueryBus, useValue: queryBus 
                    },
                    {
                        provide: SessionService, useValue: sessionService 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(UpcomingOccurrencesResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("maps materialised rows and preview dates onto an UpcomingOccurrencesResponse",
            async () => {
                const result: UpcomingOccurrencesQueryResult = {
                    ruleId: "rule-1",
                    materialised: [
                        {
                            occurrenceId: "occ-1", localDate: "2026-09-19", dueAtUtc: "2026-09-19T07:00:00.000Z", status: "pending" 
                        },
                        {
                            occurrenceId: "occ-2", localDate: "2026-09-20", dueAtUtc: "2026-09-20T07:00:00.000Z", status: "done" 
                        },
                    ],
                    previewDates: ["2026-09-21",
                        "2026-09-22"],
                }
                queryBus.execute.mockResolvedValue(result)

                const response = await resolver.upcomingOccurrences(req("Bearer token-1"),
                    {
                        ruleId: "rule-1"
                    })

                expect(response).toEqual(
                    new UpcomingOccurrencesResponse(
                        "rule-1",
                        [
                            new MaterialisedOccurrenceResponse("occ-1",
                                "2026-09-19",
                                "2026-09-19T07:00:00.000Z",
                                "pending"),
                            new MaterialisedOccurrenceResponse("occ-2",
                                "2026-09-20",
                                "2026-09-20T07:00:00.000Z",
                                "done"),
                        ],
                        ["2026-09-21",
                            "2026-09-22"],
                    ),
                )
                expect(response).toBeInstanceOf(UpcomingOccurrencesResponse)
                expect(response.materialised.every(o => o instanceof MaterialisedOccurrenceResponse)).toBe(true)
            })

        it("threads the ruleId argument and the session actor into the query params",
            async () => {
                queryBus.execute.mockResolvedValue({
                    ruleId: "rule-1", materialised: [], previewDates: [] 
                })

                await resolver.upcomingOccurrences(req("Bearer token-1"),
                    {
                        ruleId: "rule-1"
                    })

                expect(sessionService.findActive).toHaveBeenCalledWith("token-1")
                const query = queryBus.execute.mock.calls[0][0]
                expect(query).toBeInstanceOf(UpcomingOccurrencesQuery)
                expect(query.params).toEqual({
                    ruleId: "rule-1", actorId: "person-1" 
                })
            })

        it("shows an ended rule as history only: materialised rows stay, previewDates is empty",
            async () => {
                queryBus.execute.mockResolvedValue({
                    ruleId: "rule-ended",
                    materialised: [{
                        occurrenceId: "occ-1", localDate: "2026-09-01", dueAtUtc: "2026-09-01T07:00:00.000Z", status: "done" 
                    }],
                    previewDates: [],
                })

                const response = await resolver.upcomingOccurrences(req("Bearer token-1"),
                    {
                        ruleId: "rule-ended"
                    })

                expect(response.materialised).toHaveLength(1)
                expect(response.previewDates).toEqual([])
            })

        it("refuses a request with no Authorization header before any query runs",
            async () => {
                await expect(resolver.upcomingOccurrences(req(),
                    {
                        ruleId: "rule-1"
                    })).rejects.toThrow(SessionNotFoundException)

                expect(sessionService.findActive).toHaveBeenCalledWith("")
                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("propagates SessionExpiredException unchanged",
            async () => {
                await expect(resolver.upcomingOccurrences(req("Bearer token-expired"),
                    {
                        ruleId: "rule-1"
                    })).rejects.toThrow(SessionExpiredException)

                expect(queryBus.execute).not.toHaveBeenCalled()
            })

        it("propagates RecurRuleNotFoundException raised inside the query bus unchanged",
            async () => {
                const failure = new RecurRuleNotFoundException()
                queryBus.execute.mockRejectedValue(failure)

                await expect(resolver.upcomingOccurrences(req("Bearer token-1"),
                    {
                        ruleId: "rule-missing"
                    })).rejects.toBe(failure)
            })

        it("propagates RecurRuleForbiddenException for a rule the actor does not own",
            async () => {
                const failure = new RecurRuleForbiddenException()
                queryBus.execute.mockRejectedValue(failure)

                await expect(resolver.upcomingOccurrences(req("Bearer token-1"),
                    {
                        ruleId: "rule-foreign"
                    })).rejects.toBe(failure)
            })
    })
