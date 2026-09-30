import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DeleteTaskRequest, DeleteTaskResult } from "./delete-task.contracts"

/** Asks to delete a task permanently. */
export class DeleteTaskCommand extends Command<DeleteTaskResult> {
    constructor(readonly params: ExecuteParams<DeleteTaskRequest>) {
        super()
    }
}
