import { Test } from "@nestjs/testing"
import type { MockEntityManager } from "@starci/jest-preset"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { TaskService } from "@modules/domain/task"
import type { TaskView } from "@modules/domain/task"
import { CLOCK } from "@modules/platform/clock"
import { LIST_ROWS_MAX, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { In } from "typeorm"
import { occurrenceRow } from "@tests/fixtures/builders/recur.builder"
import { RecurErrorCode } from "./errors/recur.error"
import { OccurrenceService } from "./occurrence.service"
import { OccurrenceEntity } from "./persistence/entities/occurrence.entity"
import { ORPHAN_ENDED_OCCURRENCES } from "./persistence/occurrence.sql"
import type { OccurrenceStatus } from "./recur.contracts"

const NOW = "2026-09-10T10:00:00.000Z"
const at = new Date(NOW)

const transitions: ReadonlyArray<readonly ["complete" | "skip", OccurrenceStatus]> = [
    ["complete", "completed"],
    ["skip", "skipped"],
]

const task: TaskView = { id: "t1", owner: "o1", title: "Stand-up", complete: false, completedAt: null }

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const tx = fakeTransaction(em)
    const tasks = mock<TaskService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            OccurrenceService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: TaskService, useValue: tasks },
        ],
    }).compile()
    return { service: moduleRef.get(OccurrenceService), em: tx.em, tx, tasks }
}

describe("OccurrenceService", () => {
    describe("materialise", () => {
        const window = {
            id: "t1",
            ruleId: "r1",
            windowKey: "r1:2026-09-02",
            localDate: "2026-09-02",
            dueAtUtc: new Date("2026-09-02T02:00:00.000Z"),
        }

        it("writes the occurrence row of a window that has none, keyed by the window key", async () => {
            const { service, em } = await build(
                mockEntityManager({ findOneBy: [OccurrenceEntity, null], save: [OccurrenceEntity, occurrenceRow()] }),
            )

            await expect(service.materialise({ manager: em, ...window })).resolves.toEqual({
                id: "t1",
                ruleId: "r1",
                windowKey: "r1:2026-09-02",
                localDate: "2026-09-02",
                dueAtUtc: window.dueAtUtc,
                status: "materialised",
            })

            expect(em.findOneBy).toHaveBeenCalledWith(OccurrenceEntity, { windowKey: "r1:2026-09-02" })
            expect(em.save).toHaveBeenCalledWith(OccurrenceEntity, { ...window, status: "materialised" })
        })

        it("returns the existing row of a window that already has one and saves nothing", async () => {
            const existing = occurrenceRow({ id: "t0", status: "completed" })
            const { service, em } = await build(mockEntityManager({ findOneBy: [OccurrenceEntity, existing] }))

            await expect(service.materialise({ manager: em, ...window })).resolves.toMatchObject({
                id: "t0",
                status: "completed",
            })
            expect(em.save).not.toHaveBeenCalled()
        })
    })

    describe("existingWindowKeys", () => {
        it("answers an empty set without reading when there are no keys", async () => {
            const { service } = await build()

            await expect(service.existingWindowKeys({ windowKeys: [] })).resolves.toEqual(new Set())
        })

        it("returns the keys that already have a row", async () => {
            const { service, em } = await build(mockEntityManager({ find: [OccurrenceEntity, [occurrenceRow()]] }))

            await expect(
                service.existingWindowKeys({ windowKeys: ["r1:2026-09-02", "r1:2026-09-03"] }),
            ).resolves.toEqual(new Set(["r1:2026-09-02"]))
            expect(em.find).toHaveBeenCalledWith(OccurrenceEntity, {
                where: { windowKey: In(["r1:2026-09-02", "r1:2026-09-03"]) },
                take: LIST_ROWS_MAX,
            })
        })

        it("reads the keys in chunks of LIST_ROWS_MAX", async () => {
            const keys = Array.from({ length: LIST_ROWS_MAX + 1 }, (_unused, index) => `r1:${index}`)
            const { service, em } = await build(mockEntityManager({ find: [OccurrenceEntity, []] }))

            await expect(service.existingWindowKeys({ windowKeys: keys })).resolves.toEqual(new Set())
            expect(em.find).toHaveBeenCalledTimes(2)
            expect(em.find).toHaveBeenNthCalledWith(1, OccurrenceEntity, {
                where: { windowKey: In(keys.slice(0, LIST_ROWS_MAX)) },
                take: LIST_ROWS_MAX,
            })
            expect(em.find).toHaveBeenNthCalledWith(2, OccurrenceEntity, {
                where: { windowKey: In(keys.slice(LIST_ROWS_MAX)) },
                take: LIST_ROWS_MAX,
            })
        })
    })

    describe("listByRule", () => {
        it("lists the occurrences of one rule, oldest local date first", async () => {
            const { service, em } = await build(mockEntityManager({ find: [OccurrenceEntity, [occurrenceRow()]] }))

            await expect(service.listByRule({ ruleId: "r1" })).resolves.toEqual([
                {
                    id: "t1",
                    ruleId: "r1",
                    windowKey: "r1:2026-09-02",
                    localDate: "2026-09-02",
                    dueAtUtc: new Date("2026-09-02T02:00:00.000Z"),
                    status: "materialised",
                },
            ])
            expect(em.find).toHaveBeenCalledWith(OccurrenceEntity, {
                where: { ruleId: "r1" },
                order: { localDate: "ASC" },
                take: LIST_ROWS_MAX,
            })
        })
    })

    describe.each(transitions)("%s", (action, status) => {
        it("refuses an occurrence that has no row", async () => {
            const { service, em, tasks } = await build(mockEntityManager({ findOneBy: [OccurrenceEntity, null] }))

            await expect(service[action]({ id: "t1", actorId: "o1" })).resolves.toBeRefused(
                RecurErrorCode.OccurrenceNotFound,
            )
            expect(tasks.find).not.toHaveBeenCalled()
            expect(em.save).not.toHaveBeenCalled()
        })

        it("refuses an occurrence whose task is gone", async () => {
            const { service, em, tasks } = await build(
                mockEntityManager({ findOneBy: [OccurrenceEntity, occurrenceRow()] }),
            )
            tasks.find.mockResolvedValue(null)

            await expect(service[action]({ id: "t1", actorId: "o1" })).resolves.toBeRefused(
                RecurErrorCode.OccurrenceNotFound,
            )
            expect(em.save).not.toHaveBeenCalled()
        })

        it("refuses an occurrence whose task belongs to somebody else", async () => {
            const { service, em, tasks } = await build(
                mockEntityManager({ findOneBy: [OccurrenceEntity, occurrenceRow()] }),
            )
            tasks.find.mockResolvedValue(task)

            await expect(service[action]({ id: "t1", actorId: "intruder" })).resolves.toBeRefused(
                RecurErrorCode.OccurrenceForbidden,
            )
            expect(em.save).not.toHaveBeenCalled()
            expect(tasks.complete).not.toHaveBeenCalled()
        })

        it(`answers ${status} again without writing when it already is`, async () => {
            const { service, em, tasks } = await build(
                mockEntityManager({ findOneBy: [OccurrenceEntity, occurrenceRow({ status })] }),
            )
            tasks.find.mockResolvedValue(task)

            await expect(service[action]({ id: "t1", actorId: "o1" })).resolves.toSucceedWith({
                occurrenceId: "t1",
                status,
            })
            expect(em.save).not.toHaveBeenCalled()
            expect(tasks.complete).not.toHaveBeenCalled()
        })
    })

    describe("complete (write)", () => {
        it("completes the task at the clock instant and marks the occurrence completed in one transaction", async () => {
            const { service, em, tx, tasks } = await build(
                mockEntityManager({
                    findOneBy: [OccurrenceEntity, occurrenceRow()],
                    save: [OccurrenceEntity, occurrenceRow({ status: "completed" })],
                }),
            )
            tasks.find.mockResolvedValue(task)

            await expect(service.complete({ id: "t1", actorId: "o1" })).resolves.toSucceedWith({
                occurrenceId: "t1",
                status: "completed",
            })

            expect(tasks.complete).toHaveBeenCalledWith({ manager: expect.anything(), task, at })
            expect(em.save).toHaveBeenCalledWith(OccurrenceEntity, { ...occurrenceRow(), status: "completed" })
            expect(tx.commits).toBe(1)
        })
    })

    describe("skip (write)", () => {
        it("marks the occurrence skipped and leaves its task untouched", async () => {
            const { service, em, tx, tasks } = await build(
                mockEntityManager({
                    findOneBy: [OccurrenceEntity, occurrenceRow()],
                    save: [OccurrenceEntity, occurrenceRow({ status: "skipped" })],
                }),
            )
            tasks.find.mockResolvedValue(task)

            await expect(service.skip({ id: "t1", actorId: "o1" })).resolves.toSucceedWith({
                occurrenceId: "t1",
                status: "skipped",
            })

            expect(tasks.complete).not.toHaveBeenCalled()
            expect(em.save).toHaveBeenCalledWith(OccurrenceEntity, { ...occurrenceRow(), status: "skipped" })
            expect(tx.commits).toBe(1)
        })
    })

    describe("orphanEnded", () => {
        const params = { ruleId: "r1", endedAt: "2026-09-10" }

        it("returns how many rows the update touched", async () => {
            const { service, em } = await build(mockEntityManager({ query: [ORPHAN_ENDED_OCCURRENCES, [[], 3]] }))

            await expect(service.orphanEnded({ manager: em, ...params })).resolves.toBe(3)
            expect(em.query).toHaveBeenCalledWith(ORPHAN_ENDED_OCCURRENCES, ["r1", "2026-09-10"])
        })

        it.each([
            ["a result that is not an array", { affected: 3 }],
            ["a result without a numeric count", [[], "3"]],
        ])("counts none for %s", async (_label, result) => {
            const { service, em } = await build(mockEntityManager({ query: [ORPHAN_ENDED_OCCURRENCES, result] }))

            await expect(service.orphanEnded({ manager: em, ...params })).resolves.toBe(0)
        })
    })
})
