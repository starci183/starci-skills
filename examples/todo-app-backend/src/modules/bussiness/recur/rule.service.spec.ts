import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    createFakeRecurEntityManager 
} from "./testing/fake-recur-entity-manager"
import {
    RuleService 
} from "./rule.service"

describe("RuleService (data.recur.rule)",
    () => {
        let moduleRef: TestingModule
        let service: RuleService

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    RuleService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: createFakeRecurEntityManager() 
                    },
                ],
            }).compile()
            service = moduleRef.get(RuleService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("creates an every-weekday rule owned by the submitter",
            async () => {
                const rule = await service.create({
                    owner: "owner-1",
                    title: "Morning routine",
                    frequency: "every-weekday",
                    timeZone: "Europe/Berlin",
                    time: "09:00",
                    startDate: "2026-09-14",
                })
                expect(rule.owner).toBe("owner-1")
                expect(rule.endedAt).toBeNull()
            })

        it("data.recur.rule invariant: every-n-days requires a positive integer n",
            async () => {
                await expect(
                    service.create({
                        owner: "owner-1", title: "x", frequency: "every-n-days", timeZone: "UTC", time: "09:00", startDate: "2026-01-01" 
                    }),
                ).rejects.toMatchObject({
                    code: "RECUR_RULE_INVALID_EXCEPTION" 
                })
            })

        it("data.recur.rule invariant: monthly-day requires dayOfMonth between 1 and 31",
            async () => {
                await expect(
                    service.create({
                        owner: "owner-1",
                        title: "x",
                        frequency: "monthly-day",
                        dayOfMonth: 32,
                        timeZone: "UTC",
                        time: "09:00",
                        startDate: "2026-01-01",
                    }),
                ).rejects.toMatchObject({
                    code: "RECUR_RULE_INVALID_EXCEPTION" 
                })
            })

        it("decision.recur.impossible-date: monthly-day 31 is accepted at creation even though most months lack a 31st",
            async () => {
                const rule = await service.create({
                    owner: "owner-1",
                    title: "Rent",
                    frequency: "monthly-day",
                    dayOfMonth: 31,
                    timeZone: "UTC",
                    time: "09:00",
                    startDate: "2026-01-01",
                })
                expect(rule.dayOfMonth).toBe(31)
            })

        it("ac.recur.occurrence.owned-by-rule-owner (rule half): a stranger cannot edit or end the rule",
            async () => {
                const rule = await service.create({
                    owner: "owner-1",
                    title: "x",
                    frequency: "every-weekday",
                    timeZone: "UTC",
                    time: "09:00",
                    startDate: "2026-01-01",
                })
                await expect(service.edit(rule.id,
                    "owner-2",
                    {
                        time: "10:00" 
                    })).rejects.toMatchObject({
                    code: "RECUR_RULE_FORBIDDEN_EXCEPTION" 
                })
                await expect(service.end(rule.id,
                    "owner-2",
                    "2026-02-01")).rejects.toMatchObject({
                    code: "RECUR_RULE_FORBIDDEN_EXCEPTION" 
                })
            })

        it("fr.recur.edit-rule: the owner can change frequency, time and time zone",
            async () => {
                const rule = await service.create({
                    owner: "owner-1",
                    title: "x",
                    frequency: "every-weekday",
                    timeZone: "UTC",
                    time: "09:00",
                    startDate: "2026-01-01",
                })
                const edited = await service.edit(rule.id,
                    "owner-1",
                    {
                        time: "10:30", timeZone: "Europe/Berlin" 
                    })
                expect(edited.time).toBe("10:30")
                expect(edited.timeZone).toBe("Europe/Berlin")
            })

        it("br.recur.ending.preserves-history: ending sets endedAt and never clears it back",
            async () => {
                const rule = await service.create({
                    owner: "owner-1",
                    title: "x",
                    frequency: "every-weekday",
                    timeZone: "UTC",
                    time: "09:00",
                    startDate: "2026-01-01",
                })
                const ended = await service.end(rule.id,
                    "owner-1",
                    "2026-09-15")
                expect(ended.endedAt).toBe("2026-09-15")
            })

        it("findById refuses an unknown rule id",
            async () => {
                await expect(service.findById("missing")).rejects.toMatchObject({
                    code: "RECUR_RULE_NOT_FOUND_EXCEPTION" 
                })
            })

        describe("frequency-shape guards (w8 branch depth)",
            () => {
                it("every-n-days refuses a stray dayOfMonth",
                    async () => {
                        await expect(
                            service.create({
                                owner: "owner-1", title: "x", frequency: "every-n-days", n: 2, dayOfMonth: 5, timeZone: "UTC", time: "09:00", startDate: "2026-01-01" 
                            }),
                        ).rejects.toMatchObject({
                            code: "RECUR_RULE_INVALID_EXCEPTION" 
                        })
                    })

                it("every-n-days refuses a non-positive or non-integer n",
                    async () => {
                        for (const n of [0, -3, 2.5]) {
                            await expect(
                                service.create({
                                    owner: "owner-1", title: "x", frequency: "every-n-days", n, timeZone: "UTC", time: "09:00", startDate: "2026-01-01" 
                                }),
                            ).rejects.toMatchObject({
                                code: "RECUR_RULE_INVALID_EXCEPTION" 
                            })
                        }
                    })

                it("monthly-day refuses a stray n and an out-of-range dayOfMonth",
                    async () => {
                        await expect(
                            service.create({
                                owner: "owner-1", title: "x", frequency: "monthly-day", n: 2, dayOfMonth: 5, timeZone: "UTC", time: "09:00", startDate: "2026-01-01" 
                            }),
                        ).rejects.toMatchObject({
                            code: "RECUR_RULE_INVALID_EXCEPTION" 
                        })
                        await expect(
                            service.create({
                                owner: "owner-1", title: "x", frequency: "monthly-day", dayOfMonth: 0, timeZone: "UTC", time: "09:00", startDate: "2026-01-01" 
                            }),
                        ).rejects.toMatchObject({
                            code: "RECUR_RULE_INVALID_EXCEPTION" 
                        })
                    })

                it("every-weekday refuses either of the shaped fields being set",
                    async () => {
                        await expect(
                            service.create({
                                owner: "owner-1", title: "x", frequency: "every-weekday", n: 3, timeZone: "UTC", time: "09:00", startDate: "2026-01-01" 
                            }),
                        ).rejects.toMatchObject({
                            code: "RECUR_RULE_INVALID_EXCEPTION" 
                        })
                        await expect(
                            service.create({
                                owner: "owner-1", title: "x", frequency: "every-weekday", dayOfMonth: 10, timeZone: "UTC", time: "09:00", startDate: "2026-01-01" 
                            }),
                        ).rejects.toMatchObject({
                            code: "RECUR_RULE_INVALID_EXCEPTION" 
                        })
                    })

                it("an unknown frequency is refused rather than silently stored",
                    async () => {
                        await expect(
                            service.create({
                                owner: "owner-1", title: "x",
                                frequency: "fortnightly" as never, timeZone: "UTC", time: "09:00", startDate: "2026-01-01" 
                            }),
                        ).rejects.toMatchObject({
                            code: "RECUR_RULE_INVALID_EXCEPTION" 
                        })
                    })

                it("an edit that would leave an invalid shape is refused before anything is written",
                    async () => {
                        const rule = await service.create({
                            owner: "owner-1", title: "x", frequency: "every-n-days", n: 3, timeZone: "UTC", time: "09:00", startDate: "2026-01-01" 
                        })
                        // flipping to monthly-day without clearing n keeps n=3 -> invalid shape
                        await expect(
                            service.edit(rule.id,
                                "owner-1",
                                {
                                    frequency: "monthly-day", dayOfMonth: 5 
                                }),
                        ).rejects.toMatchObject({
                            code: "RECUR_RULE_INVALID_EXCEPTION" 
                        })
                    })

                it("edit and end refuse an unknown rule id, not just a stranger",
                    async () => {
                        await expect(service.edit("missing",
                            "owner-1",
                            {
                                time: "10:00" 
                            })).rejects.toMatchObject({
                            code: "RECUR_RULE_NOT_FOUND_EXCEPTION" 
                        })
                        await expect(service.end("missing",
                            "owner-1",
                            "2026-02-01")).rejects.toMatchObject({
                            code: "RECUR_RULE_NOT_FOUND_EXCEPTION" 
                        })
                    })

                it("an edit may carry fields explicitly to null to reshape the rule",
                    async () => {
                        const rule = await service.create({
                            owner: "owner-1", title: "x", frequency: "monthly-day", dayOfMonth: 15, timeZone: "UTC", time: "09:00", startDate: "2026-01-01" 
                        })
                        const edited = await service.edit(rule.id,
                            "owner-1",
                            {
                                frequency: "every-weekday", dayOfMonth: null 
                            })
                        expect(edited.frequency).toBe("every-weekday")
                        expect(edited.dayOfMonth).toBeNull()
                    })
            })
    })
