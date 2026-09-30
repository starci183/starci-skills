import { mock } from "@starci/jest-preset/mock"
import type { TaskService, TaskView } from "@modules/domain/task"
import { LIST_ROWS_MAX } from "@modules/platform/database"
import { mockEntityManager } from "@tests/fixtures/database"
import { In } from "typeorm"
import { RecurErrorCode } from "./errors/recur.error"
import { OccurrenceService } from "./occurrence.service"
import { OccurrenceEntity } from "./persistence/entities/occurrence.entity"
import { ORPHAN_ENDED_OCCURRENCES } from "./persistence/occurrence.sql"
import type { OccurrenceView } from "./recur.contracts"

const AT = new Date("2026-09-30T10:00:00.000Z")
const DUE = new Date("2026-09-30T02:00:00.000Z")

const occurrence: OccurrenceView = {
    id: "t1",
    ruleId: "r1",
    windowKey: "r1:2026-09-30",
    localDate: "2026-09-30",
    dueAtUtc: DUE,
    status: "materialised",
}
const task: TaskView = { id: "t1", owner: "o1", title: "Stand-up", complete: false, completedAt: null }

const echoSave = (): jest.Mock =>
    jest.fn().mockImplementation((_target: unknown, entity: object) => Promise.resolve(entity))

const tasksWith = (found: TaskView | null): TaskService =>
    mock<TaskService>({ find: jest.fn().mockResolvedValue(found), complete: jest.fn().mockResolvedValue({ ...task, complete: true }) })

describe("OccurrenceService", () => {
    describe("materialise", () => {
        it("writes one row keyed by its window key, with the id of the task it spawned", async () => {
            const inTransaction = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null), save: echoSave() })
            const created = await new OccurrenceService(mockEntityManager(), tasksWith(task)).materialise({
                manager: inTransaction,
                id: "t1",
                ruleId: "r1",
                windowKey: "r1:2026-09-30",
                localDate: "2026-09-30",
                dueAtUtc: DUE,
            })
            expect(created).toEqual(occurrence)
            expect(inTransaction.findOneBy).toHaveBeenCalledWith(OccurrenceEntity, { windowKey: "r1:2026-09-30" })
        })

        it("changes nothing for a window that already has a row", async () => {
            const inTransaction = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue({ ...occurrence }), save: jest.fn() })
            const again = await new OccurrenceService(mockEntityManager(), tasksWith(task)).materialise({
                manager: inTransaction,
                id: "t2",
                ruleId: "r1",
                windowKey: "r1:2026-09-30",
                localDate: "2026-09-30",
                dueAtUtc: DUE,
            })
            expect(again).toEqual(occurrence)
            expect(inTransaction.save).not.toHaveBeenCalled()
        })
    })

    describe("existingWindowKeys", () => {
        it("answers the keys that already have a row, reading in bounded chunks", async () => {
            const own = mockEntityManager({ find: jest.fn().mockResolvedValue([{ ...occurrence }]) })
            const keys = Array.from({ length: LIST_ROWS_MAX + 1 }, (_unused, index) => `r1:${index}`)
            const found = await new OccurrenceService(own, tasksWith(task)).existingWindowKeys({ windowKeys: keys })
            expect(found).toEqual(new Set(["r1:2026-09-30"]))
            expect(own.find).toHaveBeenCalledTimes(2)
            expect(own.find).toHaveBeenNthCalledWith(1, OccurrenceEntity, {
                where: { windowKey: In(keys.slice(0, LIST_ROWS_MAX)) },
                take: LIST_ROWS_MAX,
            })
        })

        it("reads nothing for no keys", async () => {
            const own = mockEntityManager({ find: jest.fn() })
            await expect(new OccurrenceService(own, tasksWith(task)).existingWindowKeys({ windowKeys: [] })).resolves.toEqual(new Set())
            expect(own.find).not.toHaveBeenCalled()
        })
    })

    it("lists the occurrences of one rule in local date order, bounded", async () => {
        const own = mockEntityManager({ find: jest.fn().mockResolvedValue([{ ...occurrence }]) })
        await expect(new OccurrenceService(own, tasksWith(task)).listByRule({ ruleId: "r1" })).resolves.toEqual([occurrence])
        expect(own.find).toHaveBeenCalledWith(OccurrenceEntity, {
            where: { ruleId: "r1" },
            order: { localDate: "ASC" },
            take: LIST_ROWS_MAX,
        })
    })

    describe("complete", () => {
        it("completes the occurrence of the owner and the task it spawned in the same transaction", async () => {
            const tasks = tasksWith(task)
            const inTransaction = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue({ ...occurrence }), save: echoSave() })
            const outcome = await new OccurrenceService(mockEntityManager(), tasks).complete({
                manager: inTransaction,
                id: "t1",
                actorId: "o1",
                at: AT,
            })
            expect(outcome).toMatchObject({ kind: "ok", value: { id: "t1", status: "completed" } })
            expect(tasks.complete).toHaveBeenCalledWith({ manager: inTransaction, task, at: AT })
        })

        it("does not write again when the occurrence is already completed", async () => {
            const tasks = tasksWith(task)
            const inTransaction = mockEntityManager({
                findOneBy: jest.fn().mockResolvedValue({ ...occurrence, status: "completed" }),
                save: jest.fn(),
            })
            const outcome = await new OccurrenceService(mockEntityManager(), tasks).complete({
                manager: inTransaction,
                id: "t1",
                actorId: "o1",
                at: AT,
            })
            expect(outcome).toMatchObject({ kind: "ok", value: { status: "completed" } })
            expect(tasks.complete).not.toHaveBeenCalled()
            expect(inTransaction.save).not.toHaveBeenCalled()
        })

        it("refuses a stranger and writes nothing", async () => {
            const tasks = tasksWith(task)
            const inTransaction = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue({ ...occurrence }), save: jest.fn() })
            const outcome = await new OccurrenceService(mockEntityManager(), tasks).complete({
                manager: inTransaction,
                id: "t1",
                actorId: "stranger",
                at: AT,
            })
            expect(outcome).toMatchObject({ kind: "refused", code: RecurErrorCode.OccurrenceForbidden })
            expect(tasks.complete).not.toHaveBeenCalled()
            expect(inTransaction.save).not.toHaveBeenCalled()
        })

        it("refuses an unknown occurrence, and an occurrence whose task is gone, before touching anything", async () => {
            const unknown = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null), save: jest.fn() })
            await expect(
                new OccurrenceService(mockEntityManager(), tasksWith(task)).complete({ manager: unknown, id: "n", actorId: "o1", at: AT }),
            ).resolves.toMatchObject({ kind: "refused", code: RecurErrorCode.OccurrenceNotFound })
            const orphaned = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue({ ...occurrence }), save: jest.fn() })
            await expect(
                new OccurrenceService(mockEntityManager(), tasksWith(null)).complete({ manager: orphaned, id: "t1", actorId: "o1", at: AT }),
            ).resolves.toMatchObject({ kind: "refused", code: RecurErrorCode.OccurrenceNotFound })
            expect(unknown.save).not.toHaveBeenCalled()
            expect(orphaned.save).not.toHaveBeenCalled()
        })
    })

    describe("skip", () => {
        it("skips the occurrence of the owner without completing its task", async () => {
            const tasks = tasksWith(task)
            const inTransaction = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue({ ...occurrence }), save: echoSave() })
            const outcome = await new OccurrenceService(mockEntityManager(), tasks).skip({
                manager: inTransaction,
                id: "t1",
                actorId: "o1",
                at: AT,
            })
            expect(outcome).toMatchObject({ kind: "ok", value: { status: "skipped" } })
            expect(tasks.complete).not.toHaveBeenCalled()
        })

        it("does not write again when the occurrence is already skipped", async () => {
            const inTransaction = mockEntityManager({
                findOneBy: jest.fn().mockResolvedValue({ ...occurrence, status: "skipped" }),
                save: jest.fn(),
            })
            const outcome = await new OccurrenceService(mockEntityManager(), tasksWith(task)).skip({
                manager: inTransaction,
                id: "t1",
                actorId: "o1",
                at: AT,
            })
            expect(outcome).toMatchObject({ kind: "ok", value: { status: "skipped" } })
            expect(inTransaction.save).not.toHaveBeenCalled()
        })

        it("refuses a stranger and writes nothing", async () => {
            const inTransaction = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue({ ...occurrence }), save: jest.fn() })
            const outcome = await new OccurrenceService(mockEntityManager(), tasksWith(task)).skip({
                manager: inTransaction,
                id: "t1",
                actorId: "stranger",
                at: AT,
            })
            expect(outcome).toMatchObject({ kind: "refused", code: RecurErrorCode.OccurrenceForbidden })
            expect(inTransaction.save).not.toHaveBeenCalled()
        })
    })

    describe("orphanEnded", () => {
        it("orphans through one statement bound to the rule and the end date and counts the rows it touched", async () => {
            const inTransaction = mockEntityManager({ query: jest.fn().mockResolvedValue([[], 3]) })
            const count = await new OccurrenceService(mockEntityManager(), tasksWith(task)).orphanEnded({
                manager: inTransaction,
                ruleId: "r1",
                endedAt: "2026-09-20",
            })
            expect(count).toBe(3)
            expect(inTransaction.query).toHaveBeenCalledWith(ORPHAN_ENDED_OCCURRENCES, ["r1", "2026-09-20"])
        })
    })
})
