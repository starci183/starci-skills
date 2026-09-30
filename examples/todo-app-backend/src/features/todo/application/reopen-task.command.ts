import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReopenTaskRequest, ReopenTaskResult } from "./reopen-task.contracts"

/** Asks to reopen a completed task. */
export class ReopenTaskCommand extends Command<ReopenTaskResult> {
    constructor(readonly params: ExecuteParams<ReopenTaskRequest>) {
        super()
    }
}
