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
    MakeRecurringCommand 
} from "@modules/bussiness/recur/make-recurring.command"

import {
    RecurRuleInvalidException 
} from "@modules/shared/exceptions/errors/recur/rule-invalid"
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
    MakeRecurringInput, RecurFrequencyInput 
} from "./graphql-types/input"
import {
    MakeRecurringResolver 
} from "./make-recurring.resolver"

describe("MakeRecurringResolver (fr.recur.make-recurring)",
    () => {
        let moduleRef: TestingModule
        let resolver: MakeRecurringResolver
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
        const input = (overrides: Partial<MakeRecurringInput>): MakeRecurringInput =>
            Object.assign(new MakeRecurringInput(),
                {
                    title: "Morning routine",
                    frequency: RecurFrequencyInput.EveryWeekday,
                    timeZone: "Europe/Berlin",
                    time: "09:00",
                    startDate: "2026-09-21",
                    ...overrides,
                })
        const handlerResult = {
            ruleId: "rule-1",
            title: "Morning routine",
            frequency: "every-weekday",
            timeZone: "Europe/Berlin",
            time: "09:00",
            startDate: "2026-09-21",
        }

        beforeEach(async () => {
            execute = jest.fn()
            findActive = jest.fn()
            moduleRef = await Test.createTestingModule({
                providers: [
                    MakeRecurringResolver,
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
            resolver = moduleRef.get(MakeRecurringResolver)
        })

        afterEach(() => moduleRef.close())

        it("dispatches MakeRecurringCommand owned by the caller, with absent frequency fields mapped to null",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockResolvedValue(handlerResult)

                const result = await resolver.makeRecurring(req("tok-1"),
                    input({
                    }))

                expect(findActive).toHaveBeenCalledWith("tok-1")
                const command = execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(MakeRecurringCommand)
                expect(command.params).toEqual({
                    ownerId: "person-1",
                    title: "Morning routine",
                    frequency: "every-weekday",
                    n: null,
                    dayOfMonth: null,
                    timeZone: "Europe/Berlin",
                    time: "09:00",
                    startDate: "2026-09-21",
                })
                expect(result).toEqual(handlerResult)
            })

        it("forwards n for an every-n-days rule and dayOfMonth for a monthly-day rule",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockResolvedValue({
                    ...handlerResult, frequency: "every-n-days" 
                })
                await resolver.makeRecurring(req("tok-1"),
                    input({
                        frequency: RecurFrequencyInput.EveryNDays, n: 3 
                    }))
                expect(execute.mock.calls[0][0].params).toMatchObject({
                    frequency: "every-n-days", n: 3, dayOfMonth: null 
                })

                execute.mockResolvedValue({
                    ...handlerResult, frequency: "monthly-day" 
                })
                await resolver.makeRecurring(req("tok-1"),
                    input({
                        frequency: RecurFrequencyInput.MonthlyDay, dayOfMonth: 15 
                    }))
                expect(execute.mock.calls[1][0].params).toMatchObject({
                    frequency: "monthly-day", dayOfMonth: 15, n: null 
                })
            })

        it("propagates RecurRuleInvalidException when the rule shape breaks data.recur.rule",
            async () => {
                findActive.mockResolvedValue(activeSession())
                execute.mockRejectedValue(new RecurRuleInvalidException({
                    reason: "n is required for every-n-days" 
                }))

                await expect(
                    resolver.makeRecurring(req("tok-1"),
                        input({
                            frequency: RecurFrequencyInput.EveryNDays 
                        })),
                ).rejects.toThrow(RecurRuleInvalidException)
            })

        it("refuses before dispatch when the session is missing or expired",
            async () => {
                findActive.mockRejectedValueOnce(new SessionNotFoundException({
                    reason: "missing-token" 
                }))
                await expect(resolver.makeRecurring(req(),
                    input({
                    }))).rejects.toThrow(SessionNotFoundException)

                findActive.mockRejectedValueOnce(new SessionExpiredException())
                await expect(resolver.makeRecurring(req("tok-stale"),
                    input({
                    }))).rejects.toThrow(SessionExpiredException)

                expect(execute).not.toHaveBeenCalled()
            })
    })

/** The DTO's own class-validator contract - the checks that fire in the transport pipe before the
 * resolver body ever runs, so the command bus never sees them. */
describe("MakeRecurringInput validation",
    () => {
        const input = (overrides: Partial<MakeRecurringInput>): MakeRecurringInput =>
            Object.assign(new MakeRecurringInput(),
                {
                    title: "Morning routine",
                    frequency: RecurFrequencyInput.EveryWeekday,
                    timeZone: "Europe/Berlin",
                    time: "09:00",
                    startDate: "2026-09-21",
                    ...overrides,
                })
        const invalidProperties = async (value: MakeRecurringInput) => (await validate(value)).map((e) => e.property)

        it("accepts a well-formed every-weekday submission",
            async () => {
                expect(await invalidProperties(input({
                }))).toEqual([])
            })

        it("rejects an empty title and an empty timeZone",
            async () => {
                expect(await invalidProperties(input({
                    title: "", timeZone: "" 
                }))).toEqual(
                    expect.arrayContaining(["title",
                        "timeZone"]),
                )
            })

        it("rejects a frequency outside the RecurFrequency enum",
            async () => {
                const bad = input({
                    frequency: "weekly" as RecurFrequencyInput 
                })
                expect(await invalidProperties(bad)).toContain("frequency")
            })

        it("rejects a malformed HH:MM time and a non-YYYY-MM-DD startDate",
            async () => {
                expect(await invalidProperties(input({
                    time: "9am", startDate: "21/09/2026" 
                }))).toEqual(
                    expect.arrayContaining(["time",
                        "startDate"]),
                )
            })

        it("rejects n or dayOfMonth below 1",
            async () => {
                expect(await invalidProperties(input({
                    n: 0, dayOfMonth: 0 
                }))).toEqual(
                    expect.arrayContaining(["n",
                        "dayOfMonth"]),
                )
            })
    })
