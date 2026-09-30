import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { AuditAction } from "@modules/domain/audit"
import type { CapGuardPolicy } from "@modules/domain/plan"
import { TaskErrorCode } from "@modules/domain/task"
import type { TaskService, TaskView } from "@modules/domain/task"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import type { Outbox } from "@modules/platform/outbox"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { CreateTaskCommand } from "./create-task.command"
import { CreateTaskHandler } from "./create-task.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const principal: Principal = { id: "owner-1", roles: ["member"] }
const created: TaskView = { id: "t1", owner: "owner-1", title: "Write", complete: false, completedAt: null }

const build = (
    parts: { verdict?: Awaited<ReturnType<CapGuardPolicy["check"]>>; owned?: ReadonlyArray<TaskView>; create?: jest.Mock } = {},
): { handler: CreateTaskHandler; tasks: TaskService; capGuard: CapGuardPolicy; outbox: Outbox; inner: ReturnType<typeof mockEntityManager> } => {
    const inner = mockEntityManager()
    const tasks = mock<TaskService>({
        listOwnedBy: jest.fn().mockResolvedValue(parts.owned ?? []),
        create: parts.create ?? jest.fn().mockResolvedValue({ kind: "ok", value: created }),
    })
    const capGuard = mock<CapGuardPolicy>({ check: jest.fn().mockResolvedValue(parts.verdict ?? { allowed: true }) })
    const outbox = mock<Outbox>()
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    const handler = new CreateTaskHandler(mock<Logger>(), entityManager, new FakeClock(AT), outbox, tasks, capGuard)
    return { handler, tasks, capGuard, outbox, inner }
}

describe("CreateTaskHandler", () => {
    it("creates the task and writes the audit message in the same transaction", async () => {
        const { handler, tasks, outbox, inner } = build()
        const result = await handler.execute(new CreateTaskCommand({ request: { title: "Write" }, principal }))
        expect(result).toEqual({ kind: "ok", value: { taskId: "t1", title: "Write" } })
        expect(tasks.create).toHaveBeenCalledWith({ manager: inner, ownerId: "owner-1", title: "Write" })
        expect(outbox.enqueue).toHaveBeenCalledWith(
            inner,
            expect.objectContaining({ payload: expect.objectContaining({ action: AuditAction.TaskCreated, target: "t1" }) }),
        )
    })

    it("counts only the active tasks against the cap", async () => {
        const done: TaskView = { ...created, id: "t0", complete: true, completedAt: AT }
        const { handler, capGuard } = build({ owned: [done, created] })
        await handler.execute(new CreateTaskCommand({ request: { title: "Write" }, principal }))
        expect(capGuard.check).toHaveBeenCalledWith({ personId: "owner-1", activeTaskCount: 1 })
    })

    it("refuses with the cap and the upgrade path and writes nothing when the plan is full", async () => {
        const { handler, tasks, outbox } = build({ verdict: { allowed: false, cap: 20, upgradePath: "/plan/usage" } })
        const result = await handler.execute(new CreateTaskCommand({ request: { title: "Write" }, principal }))
        expect(result).toMatchObject({
            kind: "refused",
            code: TaskErrorCode.PlanCapExceeded,
            params: { cap: 20, upgradePath: "/plan/usage" },
        })
        expect(tasks.create).not.toHaveBeenCalled()
        expect(outbox.enqueue).not.toHaveBeenCalled()
    })

    it("returns the refusal of a blank title and writes no audit message", async () => {
        const create = jest.fn().mockResolvedValue({ kind: "refused", code: TaskErrorCode.TitleRequired })
        const { handler, outbox } = build({ create })
        const result = await handler.execute(new CreateTaskCommand({ request: { title: " " }, principal }))
        expect(result).toMatchObject({ kind: "refused", code: TaskErrorCode.TitleRequired })
        expect(outbox.enqueue).not.toHaveBeenCalled()
    })
})
