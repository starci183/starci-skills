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
    EditRecurrenceCommand 
} from "@modules/bussiness/recur/edit-recurrence.command"

import {
    RecurRuleForbiddenException 
} from "@modules/shared/exceptions/errors/recur/rule-forbidden"
import {
    RecurRuleInvalidException 
} from "@modules/shared/exceptions/errors/recur/rule-invalid"
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
    RecurFrequencyInput 
} from "../make-recurring/graphql-types/input"
import {
    EditRecurrenceInput 
} from "./graphql-types/input"
import {
    EditRecurrenceResolver 
} from "./edit-recurrence.resolver"

describe("EditRecurrenceResolver (fr.recur.edit-rule)",
    () => {
        let moduleRef: TestingModule
        let resolver: EditRecurrenceResolver
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
        const input = (overrides: Partial<EditRecurrenceInput>): EditRecurrenceInput =>
            Object.assign(new EditRecurrenceInput(),
                {
                    ruleId: "rule-1", ...overrides 
                })

        beforeEach(async () => {
            execute = jest.fn()
            findActive = jest.fn()
            moduleRef = await Test.createTestingModule({
                providers: [
                    EditRecurrenceResolver,
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
            resolver = moduleRef.get(EditRecurrenceResolver)
        })

        afterEach(() => moduleRef.close())

        it("dispatches EditRecurrenceCommand with the caller as actor and only the fields the input carries",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockResolvedValue({
                    ruleId: "rule-1", frequency: "monthly-day", timeZone: "UTC", time: "10:30" 
                })

                const result = await resolver.editRecurrence(
                    req("tok-1"),
                    input({
                        frequency: RecurFrequencyInput.MonthlyDay, dayOfMonth: 15, timeZone: "UTC", time: "10:30" 
                    }),
                )

                expect(findActive).toHaveBeenCalledWith("tok-1")
                const command = execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(EditRecurrenceCommand)
                expect(command.params).toEqual({
                    ruleId: "rule-1",
                    actorId: "person-1",
                    frequency: "monthly-day",
                    n: undefined,
                    dayOfMonth: 15,
                    timeZone: "UTC",
                    time: "10:30",
                })
                expect(result).toEqual({
                    ruleId: "rule-1", frequency: "monthly-day", timeZone: "UTC", time: "10:30" 
                })
            })

        it("propagates RecurRuleNotFoundException for a rule id that does not resolve",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockRejectedValue(new RecurRuleNotFoundException({
                    ruleId: "rule-gone" 
                }))

                await expect(resolver.editRecurrence(req("tok-1"),
                    input({
                        ruleId: "rule-gone" 
                    }))).rejects.toThrow(
                    RecurRuleNotFoundException,
                )
            })

        it("propagates RecurRuleForbiddenException when the caller does not own the rule",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockRejectedValue(new RecurRuleForbiddenException({
                    ruleId: "rule-1", actorId: "person-1" 
                }))

                await expect(resolver.editRecurrence(req("tok-1"),
                    input({
                    }))).rejects.toThrow(RecurRuleForbiddenException)
            })

        it("propagates RecurRuleInvalidException when the edit breaks the rule shape",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockRejectedValue(new RecurRuleInvalidException({
                    reason: "dayOfMonth is required for monthly-day" 
                }))

                await expect(
                    resolver.editRecurrence(req("tok-1"),
                        input({
                            frequency: RecurFrequencyInput.MonthlyDay 
                        })),
                ).rejects.toThrow(RecurRuleInvalidException)
            })

        it("refuses before dispatch when the session is missing or expired",
            async () => {
                findActive.mockRejectedValueOnce(new SessionNotFoundException({
                    reason: "missing-token" 
                }))
                await expect(resolver.editRecurrence(req(),
                    input({
                    }))).rejects.toThrow(SessionNotFoundException)

                findActive.mockRejectedValueOnce(new SessionExpiredException())
                await expect(resolver.editRecurrence(req("tok-stale"),
                    input({
                    }))).rejects.toThrow(SessionExpiredException)

                expect(execute).not.toHaveBeenCalled()
            })
    })

describe("EditRecurrenceInput validation",
    () => {
        const input = (overrides: Partial<EditRecurrenceInput>): EditRecurrenceInput =>
            Object.assign(new EditRecurrenceInput(),
                {
                    ruleId: "rule-1", ...overrides 
                })
        const invalidProperties = async (value: EditRecurrenceInput) => (await validate(value)).map((e) => e.property)

        it("accepts a sparse edit that only names the rule",
            async () => {
                expect(await invalidProperties(input({
                }))).toEqual([])
            })

        it("rejects a malformed time, a non-positive n, and a frequency outside the enum",
            async () => {
                const bad = input({
                    time: "25:99", n: 0, frequency: "hourly" as RecurFrequencyInput 
                })
                expect(await invalidProperties(bad)).toEqual(expect.arrayContaining(["time",
                    "n",
                    "frequency"]))
            })
    })
