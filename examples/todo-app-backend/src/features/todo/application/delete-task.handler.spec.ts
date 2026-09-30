import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { AuditAction } from "@modules/domain/audit"
import { TaskErrorCode } from "@modules/domain/task"
import type { TaskService, TaskView } from "@modules/domain/task"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import type { Outbox } from "@modules/platform/outbox"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { DeleteTaskCommand } from "./delete-task.command"
import { DeleteTaskHandler } from "./delete-task.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const task: TaskView = { id: "t1", owner: "owner-1", title: "Write", complete: false, completedAt: null }

/** What `build` wires: the handler and the doubles the specs assert on. */
interface Built {
    handler: DeleteTaskHandler
    tasks: TaskService
    outbox: Outbox
    inner: ReturnType<typeof mockEntityManager>
}

const build = (
    found: TaskView | null = task,
): Built => {
    const inner = mockEntityManager()
    const tasks = mock<TaskService>({ find: jest.fn().mockResolvedValue(found), remove: jest.fn().mockResolvedValue(undefined) })
    const outbox = mock<Outbox>()
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new DeleteTaskHandler(mock<Logger>(), entityManager, new FakeClock(AT), outbox, tasks), tasks, outbox, inner }
}

describe("DeleteTaskHandler", () => {
    it("deletes the task of its owner and writes the audit message in the same transaction", async () => {
        const { handler, tasks, outbox, inner } = build()
        const principal: Principal = { id: "owner-1", roles: ["member"] }
        const result = await handler.execute(new DeleteTaskCommand({ request: { taskId: "t1" }, principal }))
        expect(result).toEqual({ kind: "ok", value: { deleted: true } })
        expect(tasks.remove).toHaveBeenCalledWith({ manager: inner, id: "t1" })
        expect(outbox.enqueue).toHaveBeenCalledWith(
            inner,
            expect.objectContaining({ payload: expect.objectContaining({ action: AuditAction.TaskDeleted, target: "t1" }) }),
        )
    })

    it("refuses anyone but the owner and deletes nothing", async () => {
        const { handler, tasks, outbox } = build()
        const stranger: Principal = { id: "editor-1", roles: ["member"] }
        const result = await handler.execute(new DeleteTaskCommand({ request: { taskId: "t1" }, principal: stranger }))
        expect(result).toMatchObject({ kind: "refused", code: TaskErrorCode.Forbidden })
        expect(tasks.remove).not.toHaveBeenCalled()
        expect(outbox.enqueue).not.toHaveBeenCalled()
    })

    it("refuses an unknown task", async () => {
        const { handler } = build(null)
        const principal: Principal = { id: "owner-1", roles: ["member"] }
        await expect(handler.execute(new DeleteTaskCommand({ request: { taskId: "nope" }, principal }))).resolves.toMatchObject({
            kind: "refused",
            code: TaskErrorCode.NotFound,
        })
    })
})
