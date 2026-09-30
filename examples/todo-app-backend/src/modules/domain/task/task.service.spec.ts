import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mockEntityManager, recordingOutbox } from "@starci/jest-preset"
import { AuditAction } from "@modules/domain/audit"
import { CLOCK } from "@modules/platform/clock"
import { LIST_ROWS_MAX, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OUTBOX } from "@modules/platform/outbox"
import { completedTaskRow, TASK_AT, taskRow } from "@tests/fixtures/builders/task.builder"
import { TaskErrorCode } from "./errors/task.error"
import { TaskEntity } from "./persistence/entities/task.entity"
import { TaskService } from "./task.service"

const at = new Date(TASK_AT)

const build = async (em = mockEntityManager()) => {
    const tx = fakeTransaction(em)
    const outbox = recordingOutbox()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TaskService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(TASK_AT) },
            { provide: OUTBOX, useValue: outbox },
        ],
    }).compile()
    return { service: moduleRef.get(TaskService), em: tx.em, tx, outbox }
}

describe("TaskService", () => {
    describe("create", () => {
        it("creates a task owned by the caller with a trimmed title, through the manager it was given", async () => {
            const { service, em } = await build()
            const manager = mockEntityManager({ save: [TaskEntity, taskRow({ title: "Write" })] })

            await expect(service.create({ manager, ownerId: "owner-1", title: "  Write  " })).resolves.toSucceedWith({
                id: "t-1",
                owner: "owner-1",
                title: "Write",
                complete: false,
                completedAt: null,
            })

            expect(manager.save).toHaveBeenCalledWith(TaskEntity, {
                id: expect.any(String),
                owner: "owner-1",
                title: "Write",
                complete: false,
                completedAt: null,
            })
            expect(em.save).not.toHaveBeenCalled()
        })

        it("refuses a blank title and writes nothing", async () => {
            const { service } = await build()
            const manager = mockEntityManager()

            await expect(service.create({ manager, ownerId: "owner-1", title: "   " })).resolves.toBeRefused(
                TaskErrorCode.TitleRequired,
            )
            expect(manager.save).not.toHaveBeenCalled()
        })
    })

    describe("find", () => {
        it("answers the task with this id", async () => {
            const { service, em } = await build(mockEntityManager({ findOneBy: [TaskEntity, taskRow()] }))

            await expect(service.find({ id: "t-1" })).resolves.toEqual(taskRow())
            expect(em.findOneBy).toHaveBeenCalledWith(TaskEntity, { id: "t-1" })
        })

        it("answers null for an unknown id", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [TaskEntity, null] }))

            await expect(service.find({ id: "nope" })).resolves.toBeNull()
        })
    })

    describe("listOwnedBy", () => {
        it("lists only the tasks of one owner, bounded", async () => {
            const { service, em } = await build(mockEntityManager({ find: [TaskEntity, [taskRow()]] }))

            await expect(service.listOwnedBy({ ownerId: "owner-1" })).resolves.toEqual([taskRow()])
            expect(em.find).toHaveBeenCalledWith(TaskEntity, { where: { owner: "owner-1" }, take: LIST_ROWS_MAX })
        })
    })

    describe("complete", () => {
        it("completes an open task at the given instant", async () => {
            const { service } = await build()
            const manager = mockEntityManager({ save: [TaskEntity, completedTaskRow()] })

            await expect(service.complete({ manager, task: taskRow(), at })).resolves.toEqual(completedTaskRow())
            expect(manager.save).toHaveBeenCalledWith(TaskEntity, {
                id: "t-1",
                owner: "owner-1",
                title: "Write",
                complete: true,
                completedAt: at,
            })
        })

        it("leaves a complete task untouched when it is completed again", async () => {
            const { service } = await build()
            const manager = mockEntityManager()
            const done = completedTaskRow()

            await expect(service.complete({ manager, task: done, at })).resolves.toBe(done)
            expect(manager.save).not.toHaveBeenCalled()
        })
    })

    describe("reopen", () => {
        it("reopens a task and clears the completion instant", async () => {
            const { service } = await build()
            const manager = mockEntityManager({ save: [TaskEntity, taskRow()] })

            await expect(service.reopen({ manager, task: completedTaskRow(), at })).resolves.toEqual(taskRow())
            expect(manager.save).toHaveBeenCalledWith(TaskEntity, {
                id: "t-1",
                owner: "owner-1",
                title: "Write",
                complete: false,
                completedAt: null,
            })
        })
    })

    describe("remove", () => {
        it("deletes the row by id through the manager it was given", async () => {
            const { service } = await build()
            const manager = mockEntityManager({ delete: [TaskEntity, { affected: 1 }] })

            await service.remove({ manager, id: "t-1" })

            expect(manager.delete).toHaveBeenCalledWith(TaskEntity, "t-1")
        })
    })

    describe("deleteOwned", () => {
        const request = { ownerId: "owner-1", taskId: "t-1" }

        it("refuses an unknown task without opening a transaction", async () => {
            const { service, tx, outbox } = await build(mockEntityManager({ findOneBy: [TaskEntity, null] }))

            await expect(service.deleteOwned(request)).resolves.toBeRefused({
                code: TaskErrorCode.NotFound,
                params: { taskId: "t-1" },
            })
            expect(tx.outcomes).toEqual([])
            expect(outbox.messages).toEqual([])
        })

        it("refuses somebody who does not own the task, however trusted", async () => {
            const { service, tx, outbox } = await build(mockEntityManager({ findOneBy: [TaskEntity, taskRow()] }))

            await expect(service.deleteOwned({ ...request, ownerId: "collaborator" })).resolves.toBeRefused({
                code: TaskErrorCode.Forbidden,
                params: { taskId: "t-1" },
            })
            expect(tx.outcomes).toEqual([])
            expect(outbox.messages).toEqual([])
        })

        it("deletes the row and writes the audit message in the same transaction", async () => {
            const { service, tx, outbox } = await build(
                mockEntityManager({ findOneBy: [TaskEntity, taskRow()], delete: [TaskEntity, { affected: 1 }] }),
            )

            await expect(service.deleteOwned(request)).resolves.toSucceedWith({ deleted: true })

            expect(tx.committedWrites).toEqual([{ method: "delete", args: [TaskEntity, "t-1"] }])
            expect(outbox.messages.map((message) => message.payload)).toEqual([
                { actorId: "owner-1", action: AuditAction.TaskDeleted, target: "t-1", at: TASK_AT },
            ])
            expect(outbox.allInTransaction).toBe(true)
            expect(tx.commits).toBe(1)
        })
    })

    describe("listSummaries", () => {
        it("lists the owned tasks as id, title and completion only", async () => {
            const { service } = await build(
                mockEntityManager({ find: [TaskEntity, [taskRow(), completedTaskRow({ id: "t-2", title: "Ship" })]] }),
            )

            await expect(service.listSummaries({ ownerId: "owner-1" })).resolves.toEqual({
                tasks: [
                    { taskId: "t-1", title: "Write", complete: false },
                    { taskId: "t-2", title: "Ship", complete: true },
                ],
            })
        })

        it("lists nothing for an owner without tasks", async () => {
            const { service } = await build(mockEntityManager({ find: [TaskEntity, []] }))

            await expect(service.listSummaries({ ownerId: "owner-1" })).resolves.toEqual({ tasks: [] })
        })
    })

    describe("countsOf", () => {
        it("counts the open and the complete tasks of the owner", async () => {
            const { service } = await build(
                mockEntityManager({
                    find: [TaskEntity, [taskRow(), taskRow({ id: "t-2" }), completedTaskRow({ id: "t-3" })]],
                }),
            )

            await expect(service.countsOf({ ownerId: "owner-1" })).resolves.toEqual({ open: 2, complete: 1 })
        })

        it("counts zero for an owner without tasks", async () => {
            const { service } = await build(mockEntityManager({ find: [TaskEntity, []] }))

            await expect(service.countsOf({ ownerId: "owner-1" })).resolves.toEqual({ open: 0, complete: 0 })
        })
    })
})
