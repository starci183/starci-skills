import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CompleteErasureRequest, CompleteErasureResult } from "./complete-erasure.contracts"

/** Asks to complete a verified erasure request of the caller: the subject key is destroyed. */
export class CompleteErasureCommand extends Command<CompleteErasureResult> {
    constructor(readonly params: ExecuteParams<CompleteErasureRequest>) {
        super()
    }
}
