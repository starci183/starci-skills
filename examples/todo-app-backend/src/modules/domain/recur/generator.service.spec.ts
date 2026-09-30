import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingOutbox } from "@starci/jest-preset"
import { AuditAction } from "@modules/domain/audit"
import { CapGuardPolicy } from "@modules/domain/plan"
import { TaskErrorCode, TaskService } from "@modules/domain/task"
import type { TaskView } from "@modules/domain/task"
import { CLOCK } from "@modules/platform/clock"
import { LIST_ROWS_MAX, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OUTBOX } from "@modules/platform/outbox"
import { ok, refused } from "@modules/platform/primitives"
import { RecurErrorCode } from "./errors/recur.error"
import { GeneratorService } from "./generator.service"
import { OccurrenceService } from "./occurrence.service"
import { RuleFrequency } from "./recur.contracts"
import type { OccurrenceView, RuleView } from "./recur.contracts"
import { RecurLogEvent } from "./recur.log-events"
import { RuleService } from "./rule.service"

const NOW = "2026-09-10T10:00:00.000Z"
const at = new Date(NOW)

const rule = (overrides: Partial<RuleView> = {}): RuleView => ({
    id: "r1",
    owner: "o1",
    title: "Stand-up",
    frequency: RuleFrequency.EveryNDays,
    n: 1,
    dayOfMonth: null,
    timeZone: "Asia/Ho_Chi_Minh",
    time: "09:00",
    startDate: "2026-09-08",
    endedAt: null,
    ...overrides,
})

const task = (id: string, overrides: Partial<TaskView> = {}): TaskView => ({
    id,
    owner: "o1",
    title: "Stand-up",
    complete: false,
    completedAt: null,
    ...overrides,
})

const stored = (overrides: Partial<OccurrenceView> = {}): OccurrenceView => ({
    id: "t1",
    ruleId: "r1",
    windowKey: "r1:2026-09-08",
    localDate: "2026-09-08",
    dueAtUtc: new Date("2026-09-08T02:00:00.000Z"),
    status: "materialised",
    ...overrides,
})

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const outbox = recordingOutbox()
    const logger = mock<Logger>()
    const rules = mock<RuleService>()
    const occurrences = mock<OccurrenceService>()
    const tasks = mock<TaskService>()
    const capGuard = mock<CapGuardPolicy>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            GeneratorService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: OUTBOX, useValue: outbox },
            { provide: LOGGER, useValue: logger },
            { provide: RuleService, useValue: rules },
            { provide: OccurrenceService, useValue: occurrences },
            { provide: TaskService, useValue: tasks },
            { provide: CapGuardPolicy, useValue: capGuard },
        ],
    }).compile()
    occurrences.existingWindowKeys.mockResolvedValue(new Set())
    tasks.listOwnedBy.mockResolvedValue([])
    capGuard.check.mockResolvedValue({ allowed: true })
    return { service: moduleRef.get(GeneratorService), tx, outbox, logger, rules, occurrences, tasks, capGuard }
}

describe("GeneratorService", () => {
    describe("generate", () => {
        it("materialises every owed occurrence with its task, audit line and row in one transaction each", async () => {
            const { service, tx, outbox, logger, rules, occurrences, tasks } = await build()
            rules.listBatch.mockResolvedValue([rule()])
            tasks.create.mockResolvedValueOnce(ok(task("t1"))).mockResolvedValueOnce(ok(task("t2"))).mockResolvedValueOnce(ok(task("t3")))

            await expect(service.generate({ at })).resolves.toEqual({ materialised: 3, deferred: 0 })

            expect(rules.listBatch).toHaveBeenCalledWith({ after: null })
            expect(tasks.create).toHaveBeenCalledWith({ manager: expect.anything(), ownerId: "o1", title: "Stand-up" })
            expect(occurrences.materialise.mock.calls.map(([params]) => [params.id, params.windowKey, params.localDate, params.dueAtUtc])).toEqual([
                ["t1", "r1:2026-09-08", "2026-09-08", new Date("2026-09-08T02:00:00.000Z")],
                ["t2", "r1:2026-09-09", "2026-09-09", new Date("2026-09-09T02:00:00.000Z")],
                ["t3", "r1:2026-09-10", "2026-09-10", new Date("2026-09-10T02:00:00.000Z")],
            ])
            expect(outbox.messages.map((message) => message.payload)).toEqual([
                { actorId: "o1", action: AuditAction.TaskCreated, target: "t1", at: NOW },
                { actorId: "o1", action: AuditAction.TaskCreated, target: "t2", at: NOW },
                { actorId: "o1", action: AuditAction.TaskCreated, target: "t3", at: NOW },
            ])
            expect(outbox.allInTransaction).toBe(true)
            expect(tx.commits).toBe(3)
            expect(logger.info).toHaveBeenCalledWith(RecurLogEvent.GenerationMaterialised, { materialised: 3, deferred: 0 })
        })

        it("skips the windows that already have a row", async () => {
            const { service, rules, occurrences, tasks } = await build()
            rules.listBatch.mockResolvedValue([rule()])
            occurrences.existingWindowKeys.mockResolvedValue(new Set(["r1:2026-09-08", "r1:2026-09-09"]))
            tasks.create.mockResolvedValue(ok(task("t3")))

            await expect(service.generate({ at })).resolves.toEqual({ materialised: 1, deferred: 0 })

            expect(occurrences.existingWindowKeys).toHaveBeenCalledWith({ windowKeys: ["r1:2026-09-08", "r1:2026-09-09", "r1:2026-09-10"] })
            expect(occurrences.materialise).toHaveBeenCalledTimes(1)
            expect(occurrences.materialise).toHaveBeenCalledWith(expect.objectContaining({ windowKey: "r1:2026-09-10" }))
        })

        it("defers an occurrence whose owner is at the plan cap and creates nothing", async () => {
            const { service, tx, outbox, logger, rules, occurrences, tasks, capGuard } = await build()
            rules.listBatch.mockResolvedValue([rule({ startDate: "2026-09-10" })])
            capGuard.check.mockResolvedValue({ allowed: false, cap: 3, upgradePath: "/plan/usage" })

            await expect(service.generate({ at })).resolves.toEqual({ materialised: 0, deferred: 1 })

            expect(tasks.create).not.toHaveBeenCalled()
            expect(occurrences.materialise).not.toHaveBeenCalled()
            expect(outbox.messages).toEqual([])
            expect(tx.outcomes).toEqual([])
            expect(logger.info).not.toHaveBeenCalled()
        })

        it("counts only the open tasks of the owner against the cap", async () => {
            const { service, rules, tasks, capGuard } = await build()
            rules.listBatch.mockResolvedValue([rule({ startDate: "2026-09-10" })])
            tasks.listOwnedBy.mockResolvedValue([task("a"), task("b", { complete: true, completedAt: at }), task("c")])
            tasks.create.mockResolvedValue(ok(task("t1")))

            await service.generate({ at })

            expect(tasks.listOwnedBy).toHaveBeenCalledWith({ ownerId: "o1" })
            expect(capGuard.check).toHaveBeenCalledWith({ personId: "o1", activeTaskCount: 2 })
        })

        it("defers an occurrence whose task is refused and writes no audit line and no row", async () => {
            const { service, outbox, logger, rules, occurrences, tasks } = await build()
            rules.listBatch.mockResolvedValue([rule({ startDate: "2026-09-10", title: "  " })])
            tasks.create.mockResolvedValue(refused(TaskErrorCode.TitleRequired))

            await expect(service.generate({ at })).resolves.toEqual({ materialised: 0, deferred: 1 })

            expect(outbox.messages).toEqual([])
            expect(occurrences.materialise).not.toHaveBeenCalled()
            expect(logger.info).not.toHaveBeenCalled()
        })

        it("logs the deferred count next to the materialised one", async () => {
            const { service, logger, rules, tasks } = await build()
            rules.listBatch.mockResolvedValue([rule({ startDate: "2026-09-09" })])
            tasks.create.mockResolvedValueOnce(ok(task("t1"))).mockResolvedValueOnce(refused(TaskErrorCode.TitleRequired))

            await expect(service.generate({ at })).resolves.toEqual({ materialised: 1, deferred: 1 })

            expect(logger.info).toHaveBeenCalledWith(RecurLogEvent.GenerationMaterialised, { materialised: 1, deferred: 1 })
        })

        it("stops the walk at the day an ended rule ended", async () => {
            const { service, rules, occurrences, tasks } = await build()
            rules.listBatch.mockResolvedValue([rule({ endedAt: "2026-09-09" })])
            tasks.create.mockResolvedValue(ok(task("t1")))

            await expect(service.generate({ at })).resolves.toEqual({ materialised: 2, deferred: 0 })

            expect(occurrences.existingWindowKeys).toHaveBeenCalledWith({ windowKeys: ["r1:2026-09-08", "r1:2026-09-09"] })
        })

        it("walks up to today when the rule ends in the future", async () => {
            const { service, rules, occurrences, tasks } = await build()
            rules.listBatch.mockResolvedValue([rule({ endedAt: "2026-12-31" })])
            tasks.create.mockResolvedValue(ok(task("t1")))

            await expect(service.generate({ at })).resolves.toEqual({ materialised: 3, deferred: 0 })

            expect(occurrences.existingWindowKeys).toHaveBeenCalledWith({ windowKeys: ["r1:2026-09-08", "r1:2026-09-09", "r1:2026-09-10"] })
        })

        it("owes nothing when there are no rules", async () => {
            const { service, rules, tasks, logger } = await build()
            rules.listBatch.mockResolvedValue([])

            await expect(service.generate({ at })).resolves.toEqual({ materialised: 0, deferred: 0 })

            expect(tasks.create).not.toHaveBeenCalled()
            expect(logger.info).not.toHaveBeenCalled()
        })

        it("reads the next batch after a full one and stops at a short one", async () => {
            const { service, rules, tasks } = await build()
            const full = Array.from({ length: LIST_ROWS_MAX }, (_unused, index) => rule({ id: `r-${index}`, startDate: "2027-01-01" }))
            rules.listBatch.mockResolvedValueOnce(full).mockResolvedValueOnce([rule({ id: "r-last", startDate: "2027-01-01" })])

            await expect(service.generate({ at })).resolves.toEqual({ materialised: 0, deferred: 0 })

            expect(rules.listBatch).toHaveBeenCalledTimes(2)
            expect(rules.listBatch).toHaveBeenNthCalledWith(1, { after: null })
            expect(rules.listBatch).toHaveBeenNthCalledWith(2, { after: `r-${LIST_ROWS_MAX - 1}` })
            expect(tasks.create).not.toHaveBeenCalled()
        })

        it("materialises at most LIST_ROWS_MAX occurrences per tick and leaves the rest for the next one", async () => {
            const { service, rules, occurrences, tasks } = await build()
            rules.listBatch.mockResolvedValue([rule({ startDate: "2025-01-01" }), rule({ id: "r2" })])
            tasks.create.mockResolvedValue(ok(task("t1")))

            await expect(service.generate({ at })).resolves.toEqual({ materialised: LIST_ROWS_MAX, deferred: 0 })

            expect(occurrences.existingWindowKeys).toHaveBeenCalledTimes(1)
            expect(occurrences.materialise).toHaveBeenCalledTimes(LIST_ROWS_MAX)
        })
    })

    describe("upcoming", () => {
        it("refuses a rule that does not exist", async () => {
            const { service, rules, occurrences } = await build()
            rules.find.mockResolvedValue(null)

            await expect(service.upcoming({ ruleId: "nope", actorId: "o1" })).resolves.toBeRefused(RecurErrorCode.RuleNotFound)
            expect(occurrences.listByRule).not.toHaveBeenCalled()
        })

        it("refuses somebody else's rule", async () => {
            const { service, rules, occurrences } = await build()
            rules.find.mockResolvedValue(rule())

            await expect(service.upcoming({ ruleId: "r1", actorId: "intruder" })).resolves.toBeRefused(RecurErrorCode.RuleForbidden)
            expect(occurrences.listByRule).not.toHaveBeenCalled()
        })

        it("lists the stored occurrences and previews the next 14 days from today in the zone of the rule", async () => {
            const { service, rules, occurrences } = await build()
            rules.find.mockResolvedValue(rule({ frequency: RuleFrequency.EveryWeekday, n: null }))
            occurrences.listByRule.mockResolvedValue([stored()])

            await expect(service.upcoming({ ruleId: "r1", actorId: "o1" })).resolves.toSucceedWith({
                ruleId: "r1",
                materialised: [
                    { occurrenceId: "t1", localDate: "2026-09-08", dueAtUtc: "2026-09-08T02:00:00.000Z", status: "materialised" },
                ],
                previewDates: [
                    "2026-09-10",
                    "2026-09-11",
                    "2026-09-14",
                    "2026-09-15",
                    "2026-09-16",
                    "2026-09-17",
                    "2026-09-18",
                    "2026-09-21",
                    "2026-09-22",
                    "2026-09-23",
                ],
            })
            expect(occurrences.listByRule).toHaveBeenCalledWith({ ruleId: "r1" })
        })

        it("previews only the requested number of days", async () => {
            const { service, rules, occurrences } = await build()
            rules.find.mockResolvedValue(rule({ frequency: RuleFrequency.EveryWeekday, n: null }))
            occurrences.listByRule.mockResolvedValue([])

            await expect(service.upcoming({ ruleId: "r1", actorId: "o1", previewDays: 3 })).resolves.toSucceedWith({
                ruleId: "r1",
                materialised: [],
                previewDates: ["2026-09-10", "2026-09-11"],
            })
        })

        it("gives an ended rule its history and no preview", async () => {
            const { service, rules, occurrences } = await build()
            rules.find.mockResolvedValue(rule({ endedAt: "2026-09-09" }))
            occurrences.listByRule.mockResolvedValue([stored({ status: "orphaned" })])

            await expect(service.upcoming({ ruleId: "r1", actorId: "o1" })).resolves.toSucceedWith({
                ruleId: "r1",
                materialised: [
                    { occurrenceId: "t1", localDate: "2026-09-08", dueAtUtc: "2026-09-08T02:00:00.000Z", status: "orphaned" },
                ],
                previewDates: [],
            })
        })
    })
})
