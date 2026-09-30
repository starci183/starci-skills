import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import type { AccessService } from "@modules/domain/share"
import { TaskErrorCode } from "@modules/domain/task"
import type { TaskService, TaskView } from "@modules/domain/task"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { ReopenTaskCommand } from "./reopen-task.command"
import { ReopenTaskHandler } from "./reopen-task.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "owner-1", roles: ["member"] }
const done: TaskView = { id: "t1", owner: "owner-1", title: "Write", complete: true, completedAt: AT }
const open: TaskView = { ...done, complete: false, completedAt: null }

const build = (
    parts: { found?: TaskView | null; allowed?: boolean } = {},
): { handler: ReopenTaskHandler; tasks: TaskService; inner: ReturnType<typeof mockEntityManager> } => {
    const inner = mockEntityManager()
    const tasks = mock<TaskService>({
        find: jest.fn().mockResolvedValue(parts.found === undefined ? done : parts.found),
        reopen: jest.fn().mockResolvedValue(open),
    })
    const access = mock<AccessService>({ mayComplete: jest.fn().mockResolvedValue(parts.allowed ?? true) })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new ReopenTaskHandler(mock<Logger>(), entityManager, new FakeClock(AT), tasks, access), tasks, inner }
}

describe("ReopenTaskHandler", () => {
    it("reopens the task through the caller transaction", async () => {
        const { handler, tasks, inner } = build()
        const result = await handler.execute(new ReopenTaskCommand({ request: { taskId: "t1" }, principal }))
        expect(result).toEqual({ kind: "ok", value: { taskId: "t1", complete: false } })
        expect(tasks.reopen).toHaveBeenCalledWith({ manager: inner, task: done, at: AT })
    })

    it("refuses an unknown task", async () => {
        const { handler } = build({ found: null })
        await expect(handler.execute(new ReopenTaskCommand({ request: { taskId: "nope" }, principal }))).resolves.toMatchObject({
            kind: "refused",
            code: TaskErrorCode.NotFound,
        })
    })

    it("refuses a caller the access rule does not allow and writes nothing", async () => {
        const { handler, tasks } = build({ allowed: false })
        await expect(handler.execute(new ReopenTaskCommand({ request: { taskId: "t1" }, principal }))).resolves.toMatchObject({
            kind: "refused",
            code: TaskErrorCode.Forbidden,
        })
        expect(tasks.reopen).not.toHaveBeenCalled()
    })
})
