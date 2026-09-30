import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { TaskError, TaskErrorCode } from "@modules/domain/task"
import type { Principal } from "@modules/platform/cqrs"
import { CreateTaskCommand } from "../../application/create-task.command"
import { CreateTaskResolver } from "./create-task.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }

describe("CreateTaskResolver", () => {
    it("dispatches one create command carrying the principal and answers the created task", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "ok", value: { taskId: "t1", title: "Write" } }),
        })
        const result = await new CreateTaskResolver(commandBus).createTask(principal, { title: "Write" })
        expect(result).toEqual({ taskId: "t1", title: "Write" })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(new CreateTaskCommand({ request: { title: "Write" }, principal }))
    })

    it("turns the plan cap refusal into the task error carrying its params", async () => {
        const params = { cap: 20, upgradePath: "/plan/usage" }
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: TaskErrorCode.PlanCapExceeded, params }),
        })
        const call = new CreateTaskResolver(commandBus).createTask(principal, { title: "Write" })
        await expect(call).rejects.toBeInstanceOf(TaskError)
        await expect(call).rejects.toMatchObject({ code: TaskErrorCode.PlanCapExceeded, params })
    })
})
