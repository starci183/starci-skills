import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { TaskError, TaskErrorCode } from "@modules/domain/task"
import type { Principal } from "@modules/platform/cqrs"
import { DeleteTaskCommand } from "../../application/delete-task.command"
import { DeleteTaskResolver } from "./delete-task.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }

describe("DeleteTaskResolver", () => {
    it("dispatches one delete command with the task id and answers the confirmation", async () => {
        const commandBus = mock<CommandBus>({ execute: jest.fn().mockResolvedValue({ kind: "ok", value: { deleted: true } }) })
        const result = await new DeleteTaskResolver(commandBus).deleteTask(principal, { id: "t1" })
        expect(result).toEqual({ deleted: true })
        expect(commandBus.execute).toHaveBeenCalledWith(new DeleteTaskCommand({ request: { taskId: "t1" }, principal }))
    })

    it("turns a forbidden refusal into the task error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: TaskErrorCode.Forbidden }),
        })
        await expect(new DeleteTaskResolver(commandBus).deleteTask(principal, { id: "t1" })).rejects.toBeInstanceOf(TaskError)
    })
})
