import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import type { AccessService } from "@modules/domain/share"
import { TaskErrorCode } from "@modules/domain/task"
import type { TaskService, TaskView } from "@modules/domain/task"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import type { Outbox } from "@modules/platform/outbox"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { CompleteTaskCommand } from "./complete-task.command"
import { CompleteTaskHandler } from "./complete-task.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "editor-1", roles: ["member"] }
const open: TaskView = { id: "t1", owner: "owner-1", title: "Write", complete: false, completedAt: null }
const done: TaskView = { ...open, complete: true, completedAt: AT }

const build = (
    parts: { found?: TaskView | null; allowed?: boolean } = {},
): { handler: CompleteTaskHandler; tasks: TaskService; access: AccessService; outbox: Outbox; inner: ReturnType<typeof mockEntityManager> } => {
    const inner = mockEntityManager()
    const tasks = mock<TaskService>({
        find: jest.fn().mockResolvedValue(parts.found === undefined ? open : parts.found),
        complete: jest.fn().mockResolvedValue(done),
    })
    const access = mock<AccessService>({ mayComplete: jest.fn().mockResolvedValue(parts.allowed ?? true) })
    const outbox = mock<Outbox>()
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    const handler = new CompleteTaskHandler(mock<Logger>(), entityManager, new FakeClock(AT), outbox, tasks, access)
    return { handler, tasks, access, outbox, inner }
}

describe("CompleteTaskHandler", () => {
    it("asks the access rule with the actor, the task and its owner, then completes and notifies the owner", async () => {
        const { handler, tasks, access, outbox, inner } = build()
        const result = await handler.execute(new CompleteTaskCommand({ request: { taskId: "t1" }, principal }))
        expect(result).toEqual({ kind: "ok", value: { taskId: "t1", complete: true } })
        expect(access.mayComplete).toHaveBeenCalledWith({ actorId: "editor-1", taskId: "t1", ownerId: "owner-1" })
        expect(tasks.complete).toHaveBeenCalledWith({ manager: inner, task: open, at: AT })
        expect(outbox.enqueue).toHaveBeenCalledTimes(2)
        expect(outbox.enqueue).toHaveBeenCalledWith(
            inner,
            expect.objectContaining({ payload: expect.objectContaining({ recipientId: "owner-1", kind: "task-complete" }) }),
        )
    })

    it("refuses an unknown task", async () => {
        const { handler, tasks } = build({ found: null })
        const result = await handler.execute(new CompleteTaskCommand({ request: { taskId: "nope" }, principal }))
        expect(result).toMatchObject({ kind: "refused", code: TaskErrorCode.NotFound, params: { taskId: "nope" } })
        expect(tasks.complete).not.toHaveBeenCalled()
    })

    it("refuses a caller the access rule does not allow and writes nothing", async () => {
        const { handler, tasks, outbox } = build({ allowed: false })
        const result = await handler.execute(new CompleteTaskCommand({ request: { taskId: "t1" }, principal }))
        expect(result).toMatchObject({ kind: "refused", code: TaskErrorCode.Forbidden })
        expect(tasks.complete).not.toHaveBeenCalled()
        expect(outbox.enqueue).not.toHaveBeenCalled()
    })
})
