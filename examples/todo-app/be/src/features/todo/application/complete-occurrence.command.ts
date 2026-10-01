import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CompleteOccurrenceRequest, CompleteOccurrenceResult } from "./complete-occurrence.contracts"

/** Asks to complete an occurrence of a rule of the caller, and the task it spawned. */
export class CompleteOccurrenceCommand extends Command<CompleteOccurrenceResult> {
    constructor(readonly params: ExecuteParams<CompleteOccurrenceRequest>) {
        super()
    }
}
