import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { TaskError, TaskErrorCode } from "@modules/domain/task"
import type { Principal } from "@modules/platform/cqrs"
import { ReopenTaskCommand } from "../../application/reopen-task.command"
import { ReopenTaskResolver } from "./reopen-task.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }

describe("ReopenTaskResolver", () => {
    it("dispatches one reopen command with the task id and answers the transition", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "ok", value: { taskId: "t1", complete: false } }),
        })
        const result = await new ReopenTaskResolver(commandBus).reopenTask(principal, { id: "t1" })
        expect(result).toEqual({ taskId: "t1", complete: false })
        expect(commandBus.execute).toHaveBeenCalledWith(new ReopenTaskCommand({ request: { taskId: "t1" }, principal }))
    })

    it("turns a not found refusal into the task error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: TaskErrorCode.NotFound }),
        })
        await expect(new ReopenTaskResolver(commandBus).reopenTask(principal, { id: "t1" })).rejects.toBeInstanceOf(TaskError)
    })
})
