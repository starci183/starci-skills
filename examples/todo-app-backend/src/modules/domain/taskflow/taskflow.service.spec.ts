import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingOutbox } from "@starci/jest-preset"
import { AuditAction } from "@modules/domain/audit"
import { NOTIFY_CHANNEL_EMAIL, NOTIFY_KIND_TASK_COMPLETE } from "@modules/domain/notify"
import { SubscriptionService } from "@modules/domain/plan"
import { AccessService } from "@modules/domain/share"
import { TaskErrorCode, TaskService } from "@modules/domain/task"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OUTBOX } from "@modules/platform/outbox"
import { ok, refused } from "@modules/platform/primitives"
import { completedTaskRow, TASK_AT, taskRow } from "@tests/fixtures/builders/task.builder"
import { TaskflowService } from "./taskflow.service"

const at = new Date(TASK_AT)

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const outbox = recordingOutbox()
    const tasks = mock<TaskService>()
    const subscriptions = mock<SubscriptionService>()
    const access = mock<AccessService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            TaskflowService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(TASK_AT) },
            { provide: OUTBOX, useValue: outbox },
            { provide: TaskService, useValue: tasks },
            { provide: SubscriptionService, useValue: subscriptions },
            { provide: AccessService, useValue: access },
        ],
    }).compile()
    return { service: moduleRef.get(TaskflowService), tx, outbox, tasks, subscriptions, access }
}

describe("TaskflowService", () => {
    describe("create", () => {
        const request = { ownerId: "owner-1", title: "Write" }

        it("creates the task and writes the audit message in one transaction", async () => {
            const { service, tx, outbox, tasks, subscriptions } = await build()
            tasks.listOwnedBy.mockResolvedValue([taskRow({ id: "a" }), completedTaskRow({ id: "b" })])
            subscriptions.checkCap.mockResolvedValue({ allowed: true })
            tasks.create.mockResolvedValue(ok(taskRow()))

            await expect(service.create(request)).resolves.toSucceedWith({ taskId: "t-1", title: "Write" })

            expect(subscriptions.checkCap).toHaveBeenCalledWith({ personId: "owner-1", activeTaskCount: 1 })
            expect(tasks.create).toHaveBeenCalledWith({ manager: expect.anything(), ownerId: "owner-1", title: "Write" })
            expect(outbox.messages.map((message) => message.payload)).toEqual([
                { actorId: "owner-1", action: AuditAction.TaskCreated, target: "t-1", at: TASK_AT },
            ])
            expect(outbox.allInTransaction).toBe(true)
            expect(tx.commits).toBe(1)
        })

        it("refuses with the cap and the upgrade path when the plan has no room, and opens no transaction", async () => {
            const { service, tx, outbox, tasks, subscriptions } = await build()
            tasks.listOwnedBy.mockResolvedValue([])
            subscriptions.checkCap.mockResolvedValue({ allowed: false, cap: 3, upgradePath: "/plan/usage" })

            await expect(service.create(request)).resolves.toBeRefused({
                code: TaskErrorCode.PlanCapExceeded,
                params: { cap: 3, upgradePath: "/plan/usage" },
            })

            expect(tasks.create).not.toHaveBeenCalled()
            expect(tx.outcomes).toEqual([])
            expect(outbox.messages).toEqual([])
        })

        it("passes the refusal of the task capability through and writes no audit message", async () => {
            const { service, outbox, tasks, subscriptions } = await build()
            tasks.listOwnedBy.mockResolvedValue([])
            subscriptions.checkCap.mockResolvedValue({ allowed: true })
            tasks.create.mockResolvedValue(refused(TaskErrorCode.TitleRequired))

            await expect(service.create({ ...request, title: " " })).resolves.toBeRefused(TaskErrorCode.TitleRequired)

            expect(outbox.messages).toEqual([])
        })
    })

    describe("complete", () => {
        const request = { actorId: "owner-1", taskId: "t-1" }

        it("refuses an unknown task", async () => {
            const { service, tx, tasks } = await build()
            tasks.find.mockResolvedValue(null)

            await expect(service.complete(request)).resolves.toBeRefused({
                code: TaskErrorCode.NotFound,
                params: { taskId: "t-1" },
            })
            expect(tx.outcomes).toEqual([])
        })

        it("refuses somebody without the right to complete, and writes nothing", async () => {
            const { service, tx, outbox, tasks, access } = await build()
            tasks.find.mockResolvedValue(taskRow())
            access.mayComplete.mockResolvedValue(false)

            await expect(service.complete({ ...request, actorId: "stranger" })).resolves.toBeRefused({
                code: TaskErrorCode.Forbidden,
                params: { taskId: "t-1" },
            })

            expect(access.mayComplete).toHaveBeenCalledWith({ actorId: "stranger", taskId: "t-1", ownerId: "owner-1" })
            expect(tx.outcomes).toEqual([])
            expect(outbox.messages).toEqual([])
        })

        it("completes the task and writes the audit line and the owner notification in one transaction", async () => {
            const { service, tx, outbox, tasks, access } = await build()
            tasks.find.mockResolvedValue(taskRow())
            access.mayComplete.mockResolvedValue(true)
            tasks.complete.mockResolvedValue(completedTaskRow())

            await expect(service.complete({ ...request, actorId: "editor-1" })).resolves.toSucceedWith({
                taskId: "t-1",
                complete: true,
            })

            expect(tasks.complete).toHaveBeenCalledWith({ manager: expect.anything(), task: taskRow(), at })
            expect(outbox.messages.map((message) => message.payload)).toEqual([
                { actorId: "editor-1", action: AuditAction.TaskCompleted, target: "t-1", at: TASK_AT },
                {
                    kind: NOTIFY_KIND_TASK_COMPLETE,
                    recipientId: "owner-1",
                    channel: NOTIFY_CHANNEL_EMAIL,
                    payload: { taskId: "t-1", completedAt: TASK_AT },
                    at: TASK_AT,
                },
            ])
            expect(outbox.allInTransaction).toBe(true)
            expect(tx.commits).toBe(1)
        })

        it("stamps the notification with the clock when the completed task carries no completion instant", async () => {
            const { service, outbox, tasks, access } = await build()
            tasks.find.mockResolvedValue(taskRow())
            access.mayComplete.mockResolvedValue(true)
            tasks.complete.mockResolvedValue(taskRow({ complete: true, completedAt: null }))

            await expect(service.complete(request)).resolves.toSucceedWith({ taskId: "t-1", complete: true })

            expect(outbox.messages[1]?.payload).toMatchObject({ payload: { taskId: "t-1", completedAt: TASK_AT } })
        })
    })

    describe("reopen", () => {
        const request = { actorId: "owner-1", taskId: "t-1" }

        it("refuses an unknown task", async () => {
            const { service, tx, tasks } = await build()
            tasks.find.mockResolvedValue(null)

            await expect(service.reopen(request)).resolves.toBeRefused({
                code: TaskErrorCode.NotFound,
                params: { taskId: "t-1" },
            })
            expect(tx.outcomes).toEqual([])
        })

        it("refuses somebody without the right to reopen", async () => {
            const { service, tx, tasks, access } = await build()
            tasks.find.mockResolvedValue(completedTaskRow())
            access.mayComplete.mockResolvedValue(false)

            await expect(service.reopen({ ...request, actorId: "stranger" })).resolves.toBeRefused({
                code: TaskErrorCode.Forbidden,
                params: { taskId: "t-1" },
            })
            expect(tx.outcomes).toEqual([])
        })

        it("reopens the task inside a transaction at the instant of the clock", async () => {
            const { service, tx, tasks, access } = await build()
            tasks.find.mockResolvedValue(completedTaskRow())
            access.mayComplete.mockResolvedValue(true)
            tasks.reopen.mockResolvedValue(taskRow())

            await expect(service.reopen(request)).resolves.toSucceedWith({ taskId: "t-1", complete: false })

            expect(tasks.reopen).toHaveBeenCalledWith({ manager: expect.anything(), task: completedTaskRow(), at })
            expect(tx.commits).toBe(1)
        })
    })
})
