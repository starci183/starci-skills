import { mock } from "@starci/jest-preset/mock"
import type { TaskService, TaskView } from "@modules/domain/task"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { TaskCountsHandler } from "./task-counts.handler"
import { TaskCountsQuery } from "./task-counts.query"

const principal: Principal = { id: "owner-1", roles: ["member"] }
const at = new Date("2026-09-30T10:00:00.000Z")
const task = (id: string, complete: boolean): TaskView => ({
    id,
    owner: "owner-1",
    title: id,
    complete,
    completedAt: complete ? at : null,
})

describe("TaskCountsHandler", () => {
    it("counts open and complete over the tasks of the caller", async () => {
        const tasks = mock<TaskService>({ listOwnedBy: jest.fn().mockResolvedValue([task("a", false), task("b", true), task("c", false)]) })
        const result = await new TaskCountsHandler(mock<Logger>(), tasks).execute(new TaskCountsQuery({ request: {}, principal }))
        expect(tasks.listOwnedBy).toHaveBeenCalledWith({ ownerId: "owner-1" })
        expect(result).toEqual({ open: 2, complete: 1 })
    })

    it("counts nothing for a caller without tasks", async () => {
        const tasks = mock<TaskService>({ listOwnedBy: jest.fn().mockResolvedValue([]) })
        await expect(
            new TaskCountsHandler(mock<Logger>(), tasks).execute(new TaskCountsQuery({ request: {}, principal })),
        ).resolves.toEqual({ open: 0, complete: 0 })
    })
})
