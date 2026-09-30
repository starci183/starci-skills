import { Test } from "@nestjs/testing"
import type { MockEntityManager } from "@starci/jest-preset"
import { fakeIds, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { LIST_ROWS_MAX, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { MoreThan } from "typeorm"
import { RecurErrorCode } from "./errors/recur.error"
import { OccurrenceService } from "./occurrence.service"
import { RuleEntity } from "./persistence/entities/rule.entity"
import { RuleFrequency } from "./recur.contracts"
import { RuleService } from "./rule.service"

const weekday: RuleEntity = {
    id: "r1",
    owner: "o1",
    title: "Stand-up",
    frequency: RuleFrequency.EveryWeekday,
    n: null,
    dayOfMonth: null,
    timeZone: "Asia/Ho_Chi_Minh",
    time: "09:00",
    startDate: "2026-09-01",
    endedAt: null,
}

const everyThreeDays: RuleEntity = { ...weekday, frequency: RuleFrequency.EveryNDays, n: 3 }

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const tx = fakeTransaction(em)
    const occurrences = mock<OccurrenceService>()
    const ids = fakeIds()
    const moduleRef = await Test.createTestingModule({
        providers: [
            RuleService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: IDS, useValue: ids },
            { provide: OccurrenceService, useValue: occurrences },
        ],
    }).compile()
    return { service: moduleRef.get(RuleService), em: tx.em, tx, occurrences }
}

describe("RuleService", () => {
    describe("create", () => {
        const request = {
            ownerId: "o1",
            title: "Stand-up",
            frequency: RuleFrequency.EveryWeekday,
            n: null,
            dayOfMonth: null,
            timeZone: "Asia/Ho_Chi_Minh",
            time: "09:00",
            startDate: "2026-09-01",
        }

        it("creates an every-weekday rule owned by the submitter in one transaction", async () => {
            const { service, em, tx } = await build(mockEntityManager({ save: [RuleEntity, weekday] }))

            await expect(service.create(request)).resolves.toSucceedWith({
                ruleId: "r1",
                title: "Stand-up",
                frequency: RuleFrequency.EveryWeekday,
                timeZone: "Asia/Ho_Chi_Minh",
                time: "09:00",
                startDate: "2026-09-01",
            })

            expect(em.save).toHaveBeenCalledWith(RuleEntity, {
                id: "00000000-0000-4000-8000-000000000001",
                owner: "o1",
                title: "Stand-up",
                frequency: RuleFrequency.EveryWeekday,
                n: null,
                dayOfMonth: null,
                timeZone: "Asia/Ho_Chi_Minh",
                time: "09:00",
                startDate: "2026-09-01",
                endedAt: null,
            })
            expect(tx.commits).toBe(1)
        })

        it("accepts a monthly-day rule naming the 31st, which most months lack", async () => {
            const monthly: RuleEntity = { ...weekday, frequency: RuleFrequency.MonthlyDay, dayOfMonth: 31 }
            const { service, em } = await build(mockEntityManager({ save: [RuleEntity, monthly] }))

            await expect(service.create({ ...request, frequency: RuleFrequency.MonthlyDay, dayOfMonth: 31 })).resolves.toSucceedWith({
                ruleId: "r1",
                title: "Stand-up",
                frequency: RuleFrequency.MonthlyDay,
                timeZone: "Asia/Ho_Chi_Minh",
                time: "09:00",
                startDate: "2026-09-01",
            })
            expect(em.save).toHaveBeenCalledWith(RuleEntity, expect.objectContaining({ dayOfMonth: 31 }))
        })

        it.each([
            [RuleFrequency.EveryNDays, null, null, "n-required"],
            [RuleFrequency.EveryNDays, 2, 5, "day-of-month-forbidden"],
            [RuleFrequency.MonthlyDay, null, 0, "day-of-month-required"],
            [RuleFrequency.MonthlyDay, null, 32, "day-of-month-required"],
            [RuleFrequency.MonthlyDay, 2, 15, "n-forbidden"],
            [RuleFrequency.EveryWeekday, 2, null, "n-forbidden"],
            [RuleFrequency.EveryWeekday, null, 5, "day-of-month-forbidden"],
        ])("refuses a %s rule with n=%s and dayOfMonth=%s as %s and writes nothing", async (frequency, n, dayOfMonth, reason) => {
            const { service, tx } = await build()

            await expect(service.create({ ...request, frequency, n, dayOfMonth })).resolves.toBeRefused({
                code: RecurErrorCode.RuleInvalid,
                params: { reason },
            })
            expect(tx.outcomes).toEqual([])
        })
    })

    describe("find", () => {
        it("returns the view of a rule that exists", async () => {
            const { service, em } = await build(mockEntityManager({ findOneBy: [RuleEntity, weekday] }))

            await expect(service.find({ id: "r1" })).resolves.toEqual(weekday)
            expect(em.findOneBy).toHaveBeenCalledWith(RuleEntity, { id: "r1" })
        })

        it("returns null for a rule that does not exist", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [RuleEntity, null] }))

            await expect(service.find({ id: "nope" })).resolves.toBeNull()
        })
    })

    describe("listBatch", () => {
        it("reads the first batch from the start in id order", async () => {
            const { service, em } = await build(mockEntityManager({ find: [RuleEntity, [weekday]] }))

            await expect(service.listBatch({ after: null })).resolves.toEqual([weekday])
            expect(em.find).toHaveBeenCalledWith(RuleEntity, { where: {}, order: { id: "ASC" }, take: LIST_ROWS_MAX })
        })

        it("reads the batch that follows the given rule id", async () => {
            const { service, em } = await build(mockEntityManager({ find: [RuleEntity, [everyThreeDays]] }))

            await expect(service.listBatch({ after: "r0" })).resolves.toEqual([everyThreeDays])
            expect(em.find).toHaveBeenCalledWith(RuleEntity, { where: { id: MoreThan("r0") }, order: { id: "ASC" }, take: LIST_ROWS_MAX })
        })
    })

    describe("edit", () => {
        it("refuses a rule that does not exist and writes nothing", async () => {
            const { service, em } = await build(mockEntityManager({ findOneBy: [RuleEntity, null] }))

            await expect(service.edit({ id: "nope", actorId: "o1", patch: {} })).resolves.toBeRefused(RecurErrorCode.RuleNotFound)
            expect(em.save).not.toHaveBeenCalled()
        })

        it("refuses somebody else's rule and writes nothing", async () => {
            const { service, em } = await build(mockEntityManager({ findOneBy: [RuleEntity, weekday] }))

            await expect(service.edit({ id: "r1", actorId: "intruder", patch: {} })).resolves.toBeRefused(RecurErrorCode.RuleForbidden)
            expect(em.save).not.toHaveBeenCalled()
        })

        it("keeps every field an empty patch does not name", async () => {
            const { service, em, tx } = await build(mockEntityManager({ findOneBy: [RuleEntity, weekday], save: [RuleEntity, weekday] }))

            await expect(service.edit({ id: "r1", actorId: "o1", patch: {} })).resolves.toSucceedWith({
                ruleId: "r1",
                frequency: RuleFrequency.EveryWeekday,
                timeZone: "Asia/Ho_Chi_Minh",
                time: "09:00",
            })
            expect(em.save).toHaveBeenCalledWith(RuleEntity, weekday)
            expect(tx.commits).toBe(1)
        })

        it("applies every field of the patch, an explicit null clearing n", async () => {
            const changed: RuleEntity = {
                ...weekday,
                frequency: RuleFrequency.MonthlyDay,
                dayOfMonth: 15,
                timeZone: "UTC",
                time: "18:30",
            }
            const { service, em } = await build(mockEntityManager({ findOneBy: [RuleEntity, everyThreeDays], save: [RuleEntity, changed] }))

            await expect(
                service.edit({
                    id: "r1",
                    actorId: "o1",
                    patch: { frequency: RuleFrequency.MonthlyDay, n: null, dayOfMonth: 15, timeZone: "UTC", time: "18:30" },
                }),
            ).resolves.toSucceedWith({ ruleId: "r1", frequency: RuleFrequency.MonthlyDay, timeZone: "UTC", time: "18:30" })
            expect(em.save).toHaveBeenCalledWith(RuleEntity, changed)
        })

        it("refuses a patch whose shape does not fit the frequency and writes nothing", async () => {
            const { service, em } = await build(mockEntityManager({ findOneBy: [RuleEntity, weekday] }))

            await expect(service.edit({ id: "r1", actorId: "o1", patch: { frequency: RuleFrequency.EveryNDays } })).resolves.toBeRefused({
                code: RecurErrorCode.RuleInvalid,
                params: { reason: "n-required" },
            })
            expect(em.save).not.toHaveBeenCalled()
        })
    })

    describe("end", () => {
        it("refuses a rule that does not exist without orphaning anything", async () => {
            const { service, occurrences } = await build(mockEntityManager({ findOneBy: [RuleEntity, null] }))

            await expect(service.end({ id: "nope", actorId: "o1", endedAt: "2026-09-10" })).resolves.toBeRefused(RecurErrorCode.RuleNotFound)
            expect(occurrences.orphanEnded).not.toHaveBeenCalled()
        })

        it("refuses somebody else's rule without orphaning anything", async () => {
            const { service, em, occurrences } = await build(mockEntityManager({ findOneBy: [RuleEntity, weekday] }))

            await expect(service.end({ id: "r1", actorId: "intruder", endedAt: "2026-09-10" })).resolves.toBeRefused(RecurErrorCode.RuleForbidden)
            expect(em.save).not.toHaveBeenCalled()
            expect(occurrences.orphanEnded).not.toHaveBeenCalled()
        })

        it("sets endedAt and orphans the materialised occurrences from that day in the same transaction", async () => {
            const ended: RuleEntity = { ...weekday, endedAt: "2026-09-10" }
            const { service, em, tx, occurrences } = await build(mockEntityManager({ findOneBy: [RuleEntity, weekday], save: [RuleEntity, ended] }))
            occurrences.orphanEnded.mockResolvedValue(2)

            await expect(service.end({ id: "r1", actorId: "o1", endedAt: "2026-09-10" })).resolves.toSucceedWith({
                ruleId: "r1",
                endedAt: "2026-09-10",
                orphanedCount: 2,
            })

            expect(em.save).toHaveBeenCalledWith(RuleEntity, ended)
            expect(occurrences.orphanEnded).toHaveBeenCalledWith({ manager: expect.anything(), ruleId: "r1", endedAt: "2026-09-10" })
            expect(tx.commits).toBe(1)
        })
    })
})
