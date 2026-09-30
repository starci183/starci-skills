import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CompleteTaskRequest, CompleteTaskResult } from "./complete-task.contracts"

/** Asks to mark a task complete. */
export class CompleteTaskCommand extends Command<CompleteTaskResult> {
    constructor(readonly params: ExecuteParams<CompleteTaskRequest>) {
        super()
    }
}
