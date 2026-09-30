import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateTaskRequest, CreateTaskResult } from "./create-task.contracts"

/** Asks to create a task owned by the caller. */
export class CreateTaskCommand extends Command<CreateTaskResult> {
    constructor(readonly params: ExecuteParams<CreateTaskRequest>) {
        super()
    }
}
