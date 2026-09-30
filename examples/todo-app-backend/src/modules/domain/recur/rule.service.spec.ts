import { LIST_ROWS_MAX } from "@modules/platform/database"
import { mockEntityManager } from "@tests/fixtures/database"
import { MoreThan } from "typeorm"
import { RecurErrorCode } from "./errors/recur.error"
import { RuleEntity } from "./persistence/entities/rule.entity"
import { RuleFrequency } from "./recur.contracts"
import type { CreateRuleParams, RuleView } from "./recur.contracts"
import { RuleService } from "./rule.service"

const rule: RuleView = {
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

const echoSave = (): jest.Mock =>
    jest.fn().mockImplementation((_target: unknown, entity: object) => Promise.resolve(entity))

const creation = (manager: ReturnType<typeof mockEntityManager>, overrides: Partial<CreateRuleParams> = {}): CreateRuleParams => ({
    manager,
    ownerId: "o1",
    title: "Stand-up",
    frequency: RuleFrequency.EveryWeekday,
    n: null,
    dayOfMonth: null,
    timeZone: "Asia/Ho_Chi_Minh",
    time: "09:00",
    startDate: "2026-09-01",
    ...overrides,
})

describe("RuleService", () => {
    describe("create", () => {
        it("creates an every-weekday rule owned by the submitter, through the manager it was handed", async () => {
            const inTransaction = mockEntityManager({ save: echoSave() })
            const own = mockEntityManager()
            const outcome = await new RuleService(own).create(creation(inTransaction))
            expect(outcome).toMatchObject({ kind: "ok", value: { owner: "o1", endedAt: null, frequency: RuleFrequency.EveryWeekday } })
            expect(inTransaction.save).toHaveBeenCalledWith(RuleEntity, expect.objectContaining({ owner: "o1", endedAt: null }))
            expect(own.save).not.toHaveBeenCalled()
        })

        it("accepts a monthly-day rule naming the 31st, which most months lack", async () => {
            const inTransaction = mockEntityManager({ save: echoSave() })
            const outcome = await new RuleService(mockEntityManager()).create(
                creation(inTransaction, { frequency: RuleFrequency.MonthlyDay, dayOfMonth: 31 }),
            )
            expect(outcome).toMatchObject({ kind: "ok", value: { dayOfMonth: 31 } })
        })

        it.each([
            [RuleFrequency.EveryNDays, null, null, "n-required"],
            [RuleFrequency.EveryNDays, 2, 5, "day-of-month-forbidden"],
            [RuleFrequency.MonthlyDay, null, 40, "day-of-month-required"],
            [RuleFrequency.MonthlyDay, 2, 5, "n-forbidden"],
            [RuleFrequency.EveryWeekday, 2, null, "n-forbidden"],
        ])("refuses the shape %s n=%s dayOfMonth=%s with the reason %s and writes nothing", async (frequency, n, dayOfMonth, reason) => {
            const inTransaction = mockEntityManager({ save: jest.fn() })
            const outcome = await new RuleService(mockEntityManager()).create(creation(inTransaction, { frequency, n, dayOfMonth }))
            expect(outcome).toEqual({ kind: "refused", code: RecurErrorCode.RuleInvalid, params: { reason } })
            expect(inTransaction.save).not.toHaveBeenCalled()
        })
    })

    describe("reads", () => {
        it("finds a rule by id and answers null for an unknown one", async () => {
            const own = mockEntityManager({ findOneBy: jest.fn().mockResolvedValueOnce({ ...rule }).mockResolvedValueOnce(null) })
            const service = new RuleService(own)
            await expect(service.find({ id: "r1" })).resolves.toEqual(rule)
            await expect(service.find({ id: "nope" })).resolves.toBeNull()
            expect(own.findOneBy).toHaveBeenCalledWith(RuleEntity, { id: "r1" })
        })

        it("lists rules in id order in bounded batches, resuming after the last id", async () => {
            const own = mockEntityManager({ find: jest.fn().mockResolvedValue([{ ...rule }]) })
            const service = new RuleService(own)
            await expect(service.listBatch({ after: null })).resolves.toEqual([rule])
            await service.listBatch({ after: "r1" })
            expect(own.find).toHaveBeenNthCalledWith(1, RuleEntity, { where: {}, order: { id: "ASC" }, take: LIST_ROWS_MAX })
            expect(own.find).toHaveBeenNthCalledWith(2, RuleEntity, {
                where: { id: MoreThan("r1") },
                order: { id: "ASC" },
                take: LIST_ROWS_MAX,
            })
        })
    })

    describe("edit", () => {
        const editing = (row: RuleView | null): ReturnType<typeof mockEntityManager> =>
            mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(row && { ...row }), save: echoSave() })

        it("lets the owner change the frequency, time and zone; absent fields keep their value", async () => {
            const inTransaction = editing({ ...rule, frequency: RuleFrequency.EveryNDays, n: 2 })
            const outcome = await new RuleService(mockEntityManager()).edit({
                manager: inTransaction,
                id: "r1",
                actorId: "o1",
                patch: { time: "10:30", timeZone: "Europe/Berlin" },
            })
            expect(outcome).toMatchObject({
                kind: "ok",
                value: { frequency: RuleFrequency.EveryNDays, n: 2, time: "10:30", timeZone: "Europe/Berlin" },
            })
        })

        it("lets an edit reshape the rule by carrying the old field explicitly to null", async () => {
            const inTransaction = editing({ ...rule, frequency: RuleFrequency.EveryNDays, n: 2 })
            const outcome = await new RuleService(mockEntityManager()).edit({
                manager: inTransaction,
                id: "r1",
                actorId: "o1",
                patch: { frequency: RuleFrequency.MonthlyDay, n: null, dayOfMonth: 15 },
            })
            expect(outcome).toMatchObject({ kind: "ok", value: { frequency: RuleFrequency.MonthlyDay, n: null, dayOfMonth: 15 } })
        })

        it("refuses a stranger and writes nothing", async () => {
            const inTransaction = editing(rule)
            const outcome = await new RuleService(mockEntityManager()).edit({
                manager: inTransaction,
                id: "r1",
                actorId: "stranger",
                patch: { time: "10:30" },
            })
            expect(outcome).toMatchObject({ kind: "refused", code: RecurErrorCode.RuleForbidden })
            expect(inTransaction.save).not.toHaveBeenCalled()
        })

        it("refuses an unknown rule", async () => {
            const outcome = await new RuleService(mockEntityManager()).edit({
                manager: editing(null),
                id: "nope",
                actorId: "o1",
                patch: {},
            })
            expect(outcome).toMatchObject({ kind: "refused", code: RecurErrorCode.RuleNotFound })
        })

        it("refuses an edit that would leave an invalid shape before anything is written", async () => {
            const inTransaction = editing(rule)
            const outcome = await new RuleService(mockEntityManager()).edit({
                manager: inTransaction,
                id: "r1",
                actorId: "o1",
                patch: { frequency: RuleFrequency.EveryNDays },
            })
            expect(outcome).toMatchObject({ kind: "refused", code: RecurErrorCode.RuleInvalid, params: { reason: "n-required" } })
            expect(inTransaction.save).not.toHaveBeenCalled()
        })
    })

    describe("end", () => {
        it("sets endedAt for the owner and keeps the row", async () => {
            const inTransaction = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue({ ...rule }), save: echoSave(), delete: jest.fn() })
            const outcome = await new RuleService(mockEntityManager()).end({
                manager: inTransaction,
                id: "r1",
                actorId: "o1",
                endedAt: "2026-09-20",
            })
            expect(outcome).toMatchObject({ kind: "ok", value: { endedAt: "2026-09-20" } })
            expect(inTransaction.delete).not.toHaveBeenCalled()
        })

        it("refuses a stranger and an unknown rule", async () => {
            const service = new RuleService(mockEntityManager())
            const stranger = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue({ ...rule }), save: jest.fn() })
            await expect(service.end({ manager: stranger, id: "r1", actorId: "x", endedAt: "2026-09-20" })).resolves.toMatchObject({
                kind: "refused",
                code: RecurErrorCode.RuleForbidden,
            })
            expect(stranger.save).not.toHaveBeenCalled()
            const unknown = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null) })
            await expect(service.end({ manager: unknown, id: "n", actorId: "o1", endedAt: "2026-09-20" })).resolves.toMatchObject({
                kind: "refused",
                code: RecurErrorCode.RuleNotFound,
            })
        })
    })
})
