import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { TaskError, TaskErrorCode } from "@modules/domain/task"
import type { Principal } from "@modules/platform/cqrs"
import { CompleteTaskCommand } from "../../application/complete-task.command"
import { CompleteTaskResolver } from "./complete-task.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }

describe("CompleteTaskResolver", () => {
    it("dispatches one complete command with the task id and answers the transition", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "ok", value: { taskId: "t1", complete: true } }),
        })
        const result = await new CompleteTaskResolver(commandBus).completeTask(principal, { id: "t1" })
        expect(result).toEqual({ taskId: "t1", complete: true })
        expect(commandBus.execute).toHaveBeenCalledWith(new CompleteTaskCommand({ request: { taskId: "t1" }, principal }))
    })

    it("turns a forbidden refusal into the task error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: TaskErrorCode.Forbidden }),
        })
        await expect(new CompleteTaskResolver(commandBus).completeTask(principal, { id: "t1" })).rejects.toBeInstanceOf(TaskError)
    })
})
