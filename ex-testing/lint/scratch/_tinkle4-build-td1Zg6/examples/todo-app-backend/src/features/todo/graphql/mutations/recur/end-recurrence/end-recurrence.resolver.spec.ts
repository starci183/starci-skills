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
    EndRecurrenceCommand 
} from "@modules/bussiness/recur/end-recurrence.command"

import {
    RecurRuleForbiddenException 
} from "@modules/shared/exceptions/errors/recur/rule-forbidden"
import {
    RecurRuleNotFoundException 
} from "@modules/shared/exceptions/errors/recur/rule-not-found"
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
    EndRecurrenceInput 
} from "./graphql-types/input"
import {
    EndRecurrenceResolver 
} from "./end-recurrence.resolver"

describe("EndRecurrenceResolver (fr.recur.end-rule)",
    () => {
        let moduleRef: TestingModule
        let resolver: EndRecurrenceResolver
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
        const input = (endedAt: string): EndRecurrenceInput =>
            Object.assign(new EndRecurrenceInput(),
                {
                    ruleId: "rule-1", endedAt 
                })

        beforeEach(async () => {
            execute = jest.fn()
            findActive = jest.fn()
            moduleRef = await Test.createTestingModule({
                providers: [
                    EndRecurrenceResolver,
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
            resolver = moduleRef.get(EndRecurrenceResolver)
        })

        afterEach(() => moduleRef.close())

        it("dispatches EndRecurrenceCommand with the caller as actor and returns the orphan count",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockResolvedValue({
                    ruleId: "rule-1", endedAt: "2026-09-30", orphanedCount: 4 
                })

                const result = await resolver.endRecurrence(req("tok-1"),
                    input("2026-09-30"))

                expect(findActive).toHaveBeenCalledWith("tok-1")
                const command = execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(EndRecurrenceCommand)
                expect(command.params).toEqual({
                    ruleId: "rule-1", actorId: "person-1", endedAt: "2026-09-30" 
                })
                expect(result).toEqual({
                    ruleId: "rule-1", endedAt: "2026-09-30", orphanedCount: 4 
                })
            })

        it("propagates RecurRuleNotFoundException for a rule id that does not resolve",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockRejectedValue(new RecurRuleNotFoundException({
                    ruleId: "rule-gone" 
                }))

                const gone = Object.assign(new EndRecurrenceInput(),
                    {
                        ruleId: "rule-gone", endedAt: "2026-09-30" 
                    })
                await expect(resolver.endRecurrence(req("tok-1"),
                    gone)).rejects.toThrow(RecurRuleNotFoundException)
            })

        it("propagates RecurRuleForbiddenException when the caller does not own the rule",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockRejectedValue(new RecurRuleForbiddenException({
                    ruleId: "rule-1", actorId: "person-1" 
                }))

                await expect(resolver.endRecurrence(req("tok-1"),
                    input("2026-09-30"))).rejects.toThrow(
                    RecurRuleForbiddenException,
                )
            })

        it("refuses before dispatch when the session is missing or expired",
            async () => {
                findActive.mockRejectedValueOnce(new SessionNotFoundException({
                    reason: "missing-token" 
                }))
                await expect(resolver.endRecurrence(req(),
                    input("2026-09-30"))).rejects.toThrow(SessionNotFoundException)

                findActive.mockRejectedValueOnce(new SessionExpiredException())
                await expect(resolver.endRecurrence(req("tok-stale"),
                    input("2026-09-30"))).rejects.toThrow(
                    SessionExpiredException,
                )

                expect(execute).not.toHaveBeenCalled()
            })
    })

describe("EndRecurrenceInput validation",
    () => {
        const input = (endedAt: string): EndRecurrenceInput =>
            Object.assign(new EndRecurrenceInput(),
                {
                    ruleId: "rule-1", endedAt 
                })
        const invalidProperties = async (value: EndRecurrenceInput) => (await validate(value)).map((e) => e.property)

        it("accepts a YYYY-MM-DD endedAt",
            async () => {
                expect(await invalidProperties(input("2026-09-30"))).toEqual([])
            })

        it("rejects an endedAt that is not a YYYY-MM-DD calendar date",
            async () => {
                expect(await invalidProperties(input("30-09-2026"))).toContain("endedAt")
                expect(await invalidProperties(input("2026-9-3"))).toContain("endedAt")
            })
    })
