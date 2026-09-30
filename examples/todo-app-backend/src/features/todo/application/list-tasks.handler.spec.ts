import { mock } from "@starci/jest-preset/mock"
import type { TaskService, TaskView } from "@modules/domain/task"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { ListTasksHandler } from "./list-tasks.handler"
import { ListTasksQuery } from "./list-tasks.query"

const principal: Principal = { id: "owner-1", roles: ["member"] }
const owned: ReadonlyArray<TaskView> = [
    { id: "t1", owner: "owner-1", title: "A", complete: false, completedAt: null },
    { id: "t2", owner: "owner-1", title: "B", complete: true, completedAt: new Date("2026-09-30T10:00:00.000Z") },
]

describe("ListTasksHandler", () => {
    it("lists exactly the tasks of the caller as summaries", async () => {
        const tasks = mock<TaskService>({ listOwnedBy: jest.fn().mockResolvedValue(owned) })
        const result = await new ListTasksHandler(mock<Logger>(), tasks).execute(new ListTasksQuery({ request: {}, principal }))
        expect(tasks.listOwnedBy).toHaveBeenCalledWith({ ownerId: "owner-1" })
        expect(result).toEqual({
            tasks: [
                { taskId: "t1", title: "A", complete: false },
                { taskId: "t2", title: "B", complete: true },
            ],
        })
    })
})
